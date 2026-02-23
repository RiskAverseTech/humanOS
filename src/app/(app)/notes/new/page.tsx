import { NoteEditorView } from '../note-editor-view'

type Props = {
  searchParams: Promise<{ folder?: string }>
}

export default async function NewNotePage({ searchParams }: Props) {
  const params = await searchParams
  return <NoteEditorView isNew initialFolder={params.folder ?? ''} />
}
