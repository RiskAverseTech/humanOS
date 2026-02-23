import { getProfileNamesByUserIds } from '@/lib/supabase/profile'
import { getDocuments, getDocumentFolders, getDocumentTags } from './actions'
import { VaultClient } from './vault-client'

type Props = {
  searchParams: Promise<{ folder?: string; tag?: string; q?: string }>
}

export default async function VaultPage({ searchParams }: Props) {
  const params = await searchParams
  const [documents, folders, tags] = await Promise.all([
    getDocuments({
      folder: params.folder || null,
      tag: params.tag || null,
      search: params.q || null,
    }),
    getDocumentFolders(),
    getDocumentTags(),
  ])
  const ownerNames = await getProfileNamesByUserIds(documents.map((doc) => doc.owner_id))

  return (
    <VaultClient
      documents={documents}
      ownerNames={ownerNames}
      folders={folders}
      tags={tags}
      activeFolder={params.folder}
      activeTag={params.tag}
      searchQuery={params.q}
    />
  )
}
