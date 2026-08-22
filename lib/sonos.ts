import { SonosManager, SonosDevice, MetaDataHelper } from "@svrooij/sonos";

export async function discoverSonosDevices(): Promise<
  { name: string; ip: string }[]
> {
  const manager = new SonosManager();
  await manager.InitializeWithDiscovery(5);
  return manager.Devices.map((d) => ({ name: d.Name, ip: d.Host }));
}

// UPnP error 701 ("Transition not available") means the requested action
// isn't valid for the transport's current state — e.g. Pause when it's
// already stopped, which happens whenever a previous play attempt failed or
// the track simply ended. That's not a real failure, just a no-op.
function isTransitionNotAvailable(err: unknown): boolean {
  const upnpErrorCode = (err as { UpnpErrorCode?: string })?.UpnpErrorCode;
  return upnpErrorCode === "701" || String(err).includes("701");
}

// Serialize all playback commands against the speaker. Without this, a
// user (or app retry) tapping play/pause again before the previous command's
// retry loop has finished sends two overlapping command sequences to the
// same physical device, which corrupts each other's state.
let commandChain: Promise<unknown> = Promise.resolve();

function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = commandChain.then(task, task);
  commandChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

// Sonos can silently ignore a SetAVTransportURI/Play issued right after a
// Pause on a different track (an internal race, not an error): it can either
// stay STOPPED, or keep playing whatever was previously queued instead of
// switching to the new track. Poll for both the transport being active AND
// the queued track actually matching what we asked for before trusting it.
async function verifyNowPlaying(
  device: SonosDevice,
  spotifyTrackUri: string,
  attempts: number,
  intervalMs: number
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    const [transportInfo, positionInfo] = await Promise.all([
      device.AVTransportService.GetTransportInfo({ InstanceID: 0 }),
      device.AVTransportService.GetPositionInfo({ InstanceID: 0 }),
    ]);
    const queuedUri = positionInfo.TrackURI ?? "";
    if (
      transportInfo.CurrentTransportState !== "STOPPED" &&
      queuedUri.includes(spotifyTrackUri)
    ) {
      return true;
    }
  }
  return false;
}

export function playSonosTrack(
  deviceIp: string,
  spotifyTrackUri: string,
  spotifySessionNumber: number
) {
  return serialized(async () => {
    const device = new SonosDevice(deviceIp);
    const { trackUri } =
      MetaDataHelper.GuessMetaDataAndTrackUri(spotifyTrackUri);
    // @svrooij/sonos hardcodes a guessed "sn" (the serial number Sonos
    // assigns to this household's linked Spotify account) which often
    // doesn't match, causing Sonos to accept the command but never actually
    // start playback.
    const correctedUri = trackUri.replace(
      /([?&]sn=)\d+/,
      `$1${spotifySessionNumber}`
    );

    const queueAndPlay = async () => {
      // A plain SetAVTransportURI/Play can get silently dropped (transport
      // stays STOPPED, or keeps playing whatever was previously queued) if
      // the transport wasn't fully idle beforehand. An explicit Stop() clears
      // that, but only if given a moment to actually take effect before the
      // next command — issuing SetAVTransportURI immediately after Stop() is
      // still silently ignored.
      await device.Stop().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await device.AVTransportService.SetAVTransportURI({
        InstanceID: 0,
        CurrentURI: correctedUri,
        CurrentURIMetaData: "",
      });
      await device.Play();
    };

    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      await queueAndPlay();
      if (await verifyNowPlaying(device, spotifyTrackUri, 4, 700)) return;
    }
    throw new Error(
      "Speaker did not start playing after several attempts. It may be offline or need a restart."
    );
  });
}

export function pauseSonos(deviceIp: string) {
  return serialized(async () => {
    const device = new SonosDevice(deviceIp);
    try {
      await device.Pause();
    } catch (err) {
      if (!isTransitionNotAvailable(err)) throw err;
    }
  });
}

export function resumeSonos(deviceIp: string) {
  return serialized(async () => {
    const device = new SonosDevice(deviceIp);
    try {
      await device.Play();
    } catch (err) {
      if (!isTransitionNotAvailable(err)) throw err;
    }
  });
}

export function setSonosVolume(deviceIp: string, volume: number) {
  return serialized(async () => {
    const device = new SonosDevice(deviceIp);
    await device.SetVolume(volume);
  });
}
