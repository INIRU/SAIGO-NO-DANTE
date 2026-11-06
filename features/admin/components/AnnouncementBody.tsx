import { Fragment, type ReactNode } from 'react'
import {
  type RichNode,
  safeAnnouncementImage,
  safeAnnouncementLink,
} from '@/lib/announcements'
import './announcements.css'
function renderNode(node: RichNode, index: number): ReactNode {
  const children = node.content?.map(renderNode)
  if (node.type === 'text') {
    let text: ReactNode = node.text
    for (const mark of node.marks ?? []) {
      if (mark.type === 'bold') text = <strong>{text}</strong>
      else if (mark.type === 'italic') text = <em>{text}</em>
      else if (mark.type === 'strike') text = <s>{text}</s>
      else if (mark.type === 'underline') text = <u>{text}</u>
      else if (mark.type === 'code') text = <code>{text}</code>
      else if (mark.type === 'link' && safeAnnouncementLink(mark.attrs?.href))
        text = (
          <a href={mark.attrs.href} target="_blank" rel="noopener noreferrer">
            {text}
          </a>
        )
    }
    return <Fragment key={index}>{text}</Fragment>
  }
  switch (node.type) {
    case 'paragraph':
      return <p key={index}>{children || <br />}</p>
    case 'heading':
      return node.attrs?.level === 3 ? (
        <h3 key={index}>{children}</h3>
      ) : (
        <h2 key={index}>{children}</h2>
      )
    case 'bulletList':
      return <ul key={index}>{children}</ul>
    case 'orderedList':
      return <ol key={index}>{children}</ol>
    case 'listItem':
      return <li key={index}>{children}</li>
    case 'blockquote':
      return <blockquote key={index}>{children}</blockquote>
    case 'hardBreak':
      return <br key={index} />
    case 'horizontalRule':
      return <hr key={index} />
    case 'image':
      return safeAnnouncementImage(node.attrs?.src) ? (
        <img
          key={index}
          src={node.attrs.src}
          alt={typeof node.attrs.alt === 'string' ? node.attrs.alt : ''}
          loading="lazy"
        />
      ) : null
    default:
      return <Fragment key={index}>{children}</Fragment>
  }
}
export default function AnnouncementBody({
  doc,
  text,
}: {
  doc?: RichNode | null
  text: string
}) {
  return (
    <div className="announcement-body">
      {doc?.type === 'doc' ? (
        doc.content?.map(renderNode)
      ) : (
        <p className="whitespace-pre-wrap">{text}</p>
      )}
    </div>
  )
}
