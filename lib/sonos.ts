import { SonosManager, SonosDevice, MetaDataHelper } from "@svrooij/sonos";

export async function discoverSonosDevices(): Promise<
  { name: string; ip: string }[]
> {
  const manager = new SonosManager();
  await manager.InitializeWithDiscovery(5);
  return manager.Devices.map((d) => ({ name: d.Name, ip: d.Host }));
}

export async function playSonosTrack(
  deviceIp: string,
  spotifyTrackUri: string
) {
  const device = new SonosDevice(deviceIp);
  const { trackUri, metadata } =
    MetaDataHelper.GuessMetaDataAndTrackUri(spotifyTrackUri);
  await device.AVTransportService.SetAVTransportURI({
    InstanceID: 0,
    CurrentURI: trackUri,
    CurrentURIMetaData: metadata,
  });
  await device.Play();
}

export async function pauseSonos(deviceIp: string) {
  const device = new SonosDevice(deviceIp);
  await device.Pause();
}

export async function resumeSonos(deviceIp: string) {
  const device = new SonosDevice(deviceIp);
  await device.Play();
}

export async function setSonosVolume(deviceIp: string, volume: number) {
  const device = new SonosDevice(deviceIp);
  await device.SetVolume(volume);
}
