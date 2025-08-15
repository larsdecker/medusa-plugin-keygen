import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const { machine_id } = req.params as { machine_id: string }
  const keygen = req.scope.resolve<any>("keygenService")

  try {
    await keygen.deleteMachine(machine_id)
    return res.status(204).json({})
  } catch (e: any) {
    return res
      .status(500)
      .json({ message: e?.message || "Failed to delete machine" })
  }
}
