import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import KeygenService from '../../../../../modules/keygen/service'

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const { machine_id } = req.params as { machine_id: string }
  const keygen = req.scope.resolve<KeygenService>('keygenService')

  try {
    await keygen.deleteMachine(machine_id)
    return res.status(204).json({})
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to delete machine'
    return res.status(500).json({ message })
  }
}
