import mongoose from 'mongoose'

const roleChangeAuditSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Author', required: true },
    actorName: { type: String, default: '' },
    actorEmail: { type: String, default: '' },
    targetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Author', required: true },
    targetName: { type: String, default: '' },
    targetEmail: { type: String, default: '' },
    fromRole: { type: String, enum: ['user', 'admin', 'superadmin'], required: true },
    toRole: { type: String, enum: ['user', 'admin', 'superadmin'], required: true },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' }
  },
  { timestamps: true }
)

export default mongoose.model('RoleChangeAudit', roleChangeAuditSchema)
