import type { IGuideImageStorage } from '../../domain/gateways/IGuideImageStorage'

export class MockGuideImageStorage implements IGuideImageStorage {
  async upload(_path: string, image: Blob): Promise<string> {
    // Keep previews usable in mock mode without making any network requests.
    const bytes = new Uint8Array(await image.arrayBuffer())
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return `data:${image.type};base64,${btoa(binary)}`
  }
}
