import { getProfileNamesByUserIds } from '@/lib/supabase/profile'
import { getGeneratedImages } from './actions'
import { ImagesClient } from './images-client'

export default async function ImagesPage() {
  const images = await getGeneratedImages()
  const ownerNames = await getProfileNamesByUserIds(images.map((image) => image.owner_id))
  return <ImagesClient images={images} ownerNames={ownerNames} />
}
