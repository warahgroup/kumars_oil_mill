import { supabase } from '@/lib/supabase'

export async function seedDefaultBusinessData(): Promise<void> {
  const { error } = await supabase.rpc('seed_default_business_data')
  if (error) throw error
}

export async function completeOnboarding(businessName: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  await seedDefaultBusinessData()

  const { error } = await supabase
    .from('business_settings')
    .update({ business_name: businessName, onboarding_completed: true })
    .eq('user_id', user.id)

  if (error) throw error
}
