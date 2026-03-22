import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

export interface PromptTemplate {
  id: string
  owner_id: string | null
  title: string
  category: 'prompt' | 'component' | 'doc'
  content: string
  description: string | null
  is_system: boolean
  db_created_at: string
  db_updated_at: string
}

const templates = ref<PromptTemplate[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

export function usePromptTemplates() {
  const prompts = computed(() => templates.value.filter(t => t.category === 'prompt'))
  const components = computed(() => templates.value.filter(t => t.category === 'component'))
  const docs = computed(() => templates.value.filter(t => t.category === 'doc'))

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      const { data, error: err } = await supabase
        .from('prompt_templates')
        .select('*')
        .order('id')
      if (err) throw err
      templates.value = data || []
    } catch (e: any) {
      error.value = e.message
    } finally {
      loading.value = false
    }
  }

  async function save(template: Partial<PromptTemplate> & { id: string }) {
    const { id, ...updates } = template
    const existing = templates.value.find(t => t.id === id)
    if (existing) {
      const { error: err } = await supabase
        .from('prompt_templates')
        .update(updates)
        .eq('id', id)
      if (err) throw err
      Object.assign(existing, updates)
    } else {
      const { data, error: err } = await supabase
        .from('prompt_templates')
        .insert({ id, ...updates })
        .select()
        .single()
      if (err) throw err
      templates.value.push(data)
    }
  }

  async function remove(id: string) {
    const { error: err } = await supabase
      .from('prompt_templates')
      .delete()
      .eq('id', id)
    if (err) throw err
    templates.value = templates.value.filter(t => t.id !== id)
  }

  async function getDependencies(id: string): Promise<string[]> {
    const { data, error: err } = await supabase.rpc('get_prompt_template_dependencies', { p_id: id })
    if (err) throw err
    return data || []
  }

  async function getUsedBy(id: string): Promise<string[]> {
    const { data, error: err } = await supabase.rpc('get_prompt_template_used_by', { p_id: id })
    if (err) throw err
    return data || []
  }

  return {
    templates,
    prompts,
    components,
    docs,
    loading,
    error,
    fetchAll,
    save,
    remove,
    getDependencies,
    getUsedBy,
  }
}
