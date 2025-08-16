import { defineWidgetConfig } from '@medusajs/admin-sdk'
import type { DetailWidgetProps, AdminCustomer } from '@medusajs/framework/types'
import { Container, Heading, Text, Button } from '@medusajs/ui'
import { useEffect, useState } from 'react'

type Machine = { id: string; name?: string | null; fingerprint?: string | null; platform?: string | null }
type License = {
  id: string
  key: string | null
  status: string
  max_machines?: number
  machines: Machine[]
}

const KeygenCustomerWidget = ({ data }: DetailWidgetProps<AdminCustomer>) => {
  const customerId = data?.id
  const [licenses, setLicenses] = useState<License[]>([])

  const load = async () => {
    if (!customerId) return
    const res = await fetch(`/admin/keygen/customers/${customerId}/licenses`, {
      credentials: 'include',
    })
    if (!res.ok) return
    const json = await res.json()
    setLicenses(json?.licenses ?? [])
  }

  useEffect(() => {
    load()
  }, [customerId])

  async function unbind(machineId: string) {
    await fetch(`/admin/keygen/machines/${machineId}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    await load()
  }

  if (!customerId) return <></>

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Keygen Licenses</Heading>
      </div>
      <div className="p-6 space-y-6">
        {licenses.length === 0 && <Text>No licenses</Text>}
        {licenses.map((lic) => (
          <div key={lic.id} className="space-y-2">
            <Text className="font-semibold">{lic.key || lic.id}</Text>
            {lic.max_machines ? (
              <Text className="text-ui-fg-subtle">
                Seats used: {lic.machines.length} / {lic.max_machines}
              </Text>
            ) : null}
            {lic.machines.length > 0 ? (
              <div className="flex flex-col gap-y-1">
                {lic.machines.map((m) => (
                  <div key={m.id} className="flex items-center gap-2">
                    <Text>{m.name || m.fingerprint || m.id}</Text>
                    <Button size="small" variant="secondary" onClick={() => unbind(m.id)}>
                      Unbind
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <Text className="text-ui-fg-subtle">No machines</Text>
            )}
          </div>
        ))}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: 'customer.details.after',
})

export default KeygenCustomerWidget
