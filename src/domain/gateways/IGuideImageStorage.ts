/** Storage boundary for public Prayer Guide images. */
export interface IGuideImageStorage {
  upload(path: string, image: Blob): Promise<string>
}
