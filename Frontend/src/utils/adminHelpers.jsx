import React from 'react'
import { Badge } from 'react-bootstrap'

export const canBlockTarget = (actorRole, targetRole, isSelf) => {
  if (isSelf) return false
  if (actorRole === 'superadmin') return targetRole === 'admin' || targetRole === 'user'
  if (actorRole === 'admin') return targetRole === 'user'
  return false
}

export const canDeleteTarget = (actorRole, targetRole, isSelf) => {
  if (isSelf) return actorRole === 'admin' || actorRole === 'superadmin'
  return targetRole === 'user'
}

export const roleBadgeVariant = (role) => {
  if (role === 'superadmin') return 'danger'
  if (role === 'admin') return 'primary'
  return 'secondary'
}

export const StatusBadge = ({ author }) => {
  if (!author.blocked) return <Badge bg="success">Attivo</Badge>
  if (!author.blockedUntil) return <Badge bg="danger">Bloccato</Badge>
  if (new Date(author.blockedUntil) < new Date()) return <Badge bg="secondary">Scaduto</Badge>
  return (
    <Badge bg="warning" text="dark">
      Bloccato fino al {new Date(author.blockedUntil).toLocaleDateString('it-IT')}
    </Badge>
  )
}
