import { ChevronDown, ChevronRight, FileCode2, Folder, FolderOpen } from 'lucide-react'
import { useState } from 'react'
import type { FileEntry } from '@tupiniquim/contracts'

interface FileTreeProps {
  entries: FileEntry[]
  selected: string | undefined
  onSelect: (path: string) => void
}

interface TreeItemProps extends Omit<FileTreeProps, 'entries'> {
  entry: FileEntry
  level: number
}

const TreeItem = ({ entry, level, selected, onSelect }: TreeItemProps): React.JSX.Element => {
  const [expanded, setExpanded] = useState(level < 1)
  const directory = entry.kind === 'directory'
  const activate = (): void => {
    if (directory) setExpanded((value) => !value)
    else onSelect(entry.relativePath)
  }
  return (
    <li>
      <button className={`tree-row ${selected === entry.relativePath ? 'selected' : ''}`} style={{ paddingLeft: 10 + level * 14 }} onClick={activate}>
        {directory ? (expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : <span className="tree-indent" />}
        {directory ? (expanded ? <FolderOpen size={14} /> : <Folder size={14} />) : <FileCode2 size={14} />}
        <span>{entry.name}</span>
      </button>
      {directory && expanded && entry.children !== undefined && (
        <ul>{entry.children.map((child) => <TreeItem key={child.relativePath} entry={child} level={level + 1} selected={selected} onSelect={(path) => onSelect(path)} />)}</ul>
      )}
    </li>
  )
}

export const FileTree = ({ entries, selected, onSelect }: FileTreeProps): React.JSX.Element => (
  <ul className="file-tree">
    {entries.map((entry) => <TreeItem key={entry.relativePath} entry={entry} level={0} selected={selected} onSelect={(path) => onSelect(path)} />)}
  </ul>
)
