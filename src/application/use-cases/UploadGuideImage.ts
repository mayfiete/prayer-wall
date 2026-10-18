import type { IGuideImageStorage } from '../../domain/gateways/IGuideImageStorage'

const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
}

export class UploadGuideImage {
  constructor(private readonly storage: IGuideImageStorage) {}

  async execute(wallId: string, image: Blob): Promise<string> {
    if (!/^[a-zA-Z0-9-]+$/.test(wallId)) throw new Error('A valid wall ID is required.')
    const extension = EXTENSIONS[image.type]
    if (typeof extension !== 'string' || image.size > 15 * 1024 * 1024) {
      throw new Error('Choose JPG, PNG, WebP or GIF images up to 15 MB each.')
    }
    return this.storage.upload(`${wallId}/prayer-guide/${crypto.randomUUID()}.${extension}`, image)
  }
}
