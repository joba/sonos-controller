import { SonosManager, SonosDevice, MetaDataHelper } from "@svrooij/sonos";
import { secondsToSonosClock } from "./sonosClock";

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
    const matches = queuedUri.includes(spotifyTrackUri);
    if (transportInfo.CurrentTransportState !== "STOPPED" && matches) {
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

    // Restarting a track that's already actively playing (Stop() while a
    // stream is genuinely mid-flight, not just idle/paused) has proven
    // unreliable on some Sonos units — the transport can get stuck STOPPED
    // and never recover. Since nothing needs to change, treat a play
    // request for the already-playing track as a no-op instead. If it's
    // merely paused on the same track, just resume it rather than tearing
    // down and rebuilding — that would restart it from the beginning.
    const [currentTransport, currentPosition] = await Promise.all([
      device.AVTransportService.GetTransportInfo({ InstanceID: 0 }),
      device.AVTransportService.GetPositionInfo({ InstanceID: 0 }),
    ]);
    const sameTrackAlreadyLoaded = (currentPosition.TrackURI ?? "").includes(
      spotifyTrackUri,
    );
    if (
      currentTransport.CurrentTransportState === "PLAYING" &&
      sameTrackAlreadyLoaded
    ) {
      return;
    }
    if (
      currentTransport.CurrentTransportState === "PAUSED_PLAYBACK" &&
      sameTrackAlreadyLoaded
    ) {
      await device.Play();
      return;
    }

    const { trackUri, metadata } =
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
      // that — but only if it actually took effect, so confirm STOPPED
      // before proceeding instead of assuming a fixed delay was enough.
      await device.Stop().catch(() => {});

      const STOP_VERIFY_ATTEMPTS = 6;
      const STOP_VERIFY_INTERVAL_MS = 400;
      for (let i = 0; i < STOP_VERIFY_ATTEMPTS; i++) {
        const info = await device.AVTransportService.GetTransportInfo({
          InstanceID: 0,
        });
        if (info.CurrentTransportState === "STOPPED") break;
        await new Promise((resolve) =>
          setTimeout(resolve, STOP_VERIFY_INTERVAL_MS),
        );
      }

      // SetAVTransportURI/Play can reject with a UPnP fault (rather than
      // just silently not taking effect) when issued right after stopping
      // a track that was genuinely mid-stream. That used to escape this
      // function entirely and abort all 3 retries after just one — treat
      // it as a failed attempt instead, same as a silent no-op, so the
      // retry loop below actually gets to retry.
      try {
        await device.AVTransportService.SetAVTransportURI({
          InstanceID: 0,
          CurrentURI: correctedUri,
          // Must be the guessed Track object, not "". @svrooij/sonos's request
          // builder only serializes a proper DIDL-Lite <CurrentURIMetaData>
          // (upnp:class + the CDUDN service token Sonos uses to pick which
          // linked Spotify account to stream from) when this is an object —
          // a string is written out as an empty tag. Without that token Sonos
          // can start playback from its local buffer but then fails to
          // resolve the stream a few seconds in, which looks like the track
          // ending or restarting.
          CurrentURIMetaData: metadata,
        });
        await device.Play();
      } catch {
        // Swallowed — verifyNowPlaying below will detect the failed
        // attempt and the loop will retry.
      }
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

// When Sonos drops a stream mid-track (transport goes STOPPED on its own,
// not from a user Pause), it resets position to 0. A plain Play() then
// resumes from the beginning, which sounds like the track restarting even
// though playback itself recovered. If we know where it stopped, seek back
// there after Play() so recovery is inaudible instead of a restart.
export function resumeSonos(deviceIp: string, resumeAtSec?: number) {
  return serialized(async () => {
    const device = new SonosDevice(deviceIp);
    try {
      await device.Play();
      if (resumeAtSec && resumeAtSec > 0) {
        try {
          await device.AVTransportService.Seek({
            InstanceID: 0,
            Unit: "REL_TIME",
            Target: secondsToSonosClock(resumeAtSec),
          });
        } catch (seekErr) {
          // UPnP 701 means this content doesn't support seeking — fall back
          // to playing from wherever Play() landed (usually the start).
          if (!isTransitionNotAvailable(seekErr)) throw seekErr;
        }
      }
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
