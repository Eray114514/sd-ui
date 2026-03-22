import apiClient from './apiClient'

export async function deleteAsset(id: string): Promise<void> {
  await apiClient.delete('/api/assets', { data: { id } })
}

export async function updateAsset(id: string, isFavorite: boolean): Promise<void> {
  await apiClient.put('/api/assets', { id, isFavorite })
}

export function getAssetDownloadUrl(path: string): string {
  return `/api/image?path=${encodeURIComponent(path)}`
}
