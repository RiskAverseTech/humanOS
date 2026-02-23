import { notFound } from 'next/navigation'
import { getNote } from '../actions'
import { NoteEditorView } from '../note-editor-view'

type Props = {
  params: Promise<{ id: string }>
}

export default async function NoteEditorPage({ params }: Props) {
  const { id } = await params
  const note = await getNote(id)

  if (!note) {
    notFound()
  }

  return <NoteEditorView note={note} />
}
