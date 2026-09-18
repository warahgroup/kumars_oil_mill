import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

type ModulePlaceholderProps = {
  title: string
  subtitle: string
  newPath: string
  accentClass: string
}

export function ModulePlaceholder({
  title,
  subtitle,
  newPath,
  accentClass,
}: ModulePlaceholderProps) {
  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          <Link to={newPath}>
            <Button className={accentClass}>New</Button>
          </Link>
        }
      />
      <Card>
        <p className="text-sm text-slate-600">
          Foundation ready. Transaction forms and history lists for this module will be implemented
          next. Stock, cost, and ledger calculations will run through secure Supabase RPC functions.
        </p>
      </Card>
    </div>
  )
}
