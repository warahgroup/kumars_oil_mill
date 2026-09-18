import { cachedQuery } from '@/lib/dataCache'
import {
  listCustomers,
  listProductPackages,
  listProducts,
  listRawMaterials,
} from '@/services/masterDataService'
import { listFinancialAccounts } from '@/services/financialService'

/** Warm common lists after sign-in so forms open faster. */
export function prefetchCommonAppData(): void {
  void Promise.all([
    cachedQuery('master:products', listProducts),
    cachedQuery('master:packages', listProductPackages),
    cachedQuery('master:materials', listRawMaterials),
    cachedQuery('master:customers', listCustomers),
    cachedQuery('financial:accounts', listFinancialAccounts),
  ])
}
