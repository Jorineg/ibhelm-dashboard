import { VueRenderer } from '@tiptap/vue-3'
import tippy, { type Instance } from 'tippy.js'
import 'tippy.js/dist/tippy.css'
import MentionList from './MentionList.vue'
import { supabase } from '@/lib/supabase'
import type { SuggestionOptions } from '@tiptap/suggestion'

export function createSuggestion(): Omit<SuggestionOptions, 'editor'> {
  return {
    items: async ({ query }: { query: string }) => {
      const { data } = await supabase.rpc('search_projects_autocomplete', {
        p_search_text: query || '',
        p_limit: 15,
      })
      return (data || []).sort((a: any, b: any) => {
        if (a.status === 'active' && b.status !== 'active') return -1
        if (a.status !== 'active' && b.status === 'active') return 1
        return 0
      })
    },
    render: () => {
      let component: VueRenderer
      let popup: Instance[]

      return {
        onStart: (props: any) => {
          component = new VueRenderer(MentionList, { props, editor: props.editor })
          if (!props.clientRect) return
          popup = tippy(document.body, {
            getReferenceClientRect: props.clientRect as () => DOMRect,
            appendTo: () => document.body,
            content: component.element!,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'top-start',
            maxWidth: 'none',
            theme: 'mention-popup',
            animation: false,
            zIndex: 50,
          }) as unknown as Instance[]
        },
        onUpdate: (props: any) => {
          component.updateProps(props)
          if (props.clientRect) {
            popup?.[0]?.setProps({ getReferenceClientRect: props.clientRect as () => DOMRect })
          }
        },
        onKeyDown: (props: any) => {
          if (props.event.key === 'Escape') {
            popup?.[0]?.hide()
            return true
          }
          return component.ref?.onKeyDown(props) ?? false
        },
        onExit: () => {
          popup?.[0]?.destroy()
          component.destroy()
        },
      }
    },
  }
}
