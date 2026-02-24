export type UserRole = 'admin' | 'partner' | 'child'
export type ThemePreference = 'light' | 'dark' | 'bray'
export type NotificationCategory = 'notes' | 'vault' | 'todos' | 'human_chat' | 'ai_chat' | 'images'
export type TimezonePreference = string

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          user_id: string
          display_name: string
          role: UserRole
          avatar_url: string | null
          theme_preference: ThemePreference
          timezone_preference: TimezonePreference
          notifications_enabled: boolean
          notification_categories: NotificationCategory[]
          notifications_last_seen_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          display_name: string
          role?: UserRole
          avatar_url?: string | null
          theme_preference?: ThemePreference
          timezone_preference?: TimezonePreference
          notifications_enabled?: boolean
          notification_categories?: NotificationCategory[]
          notifications_last_seen_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          display_name?: string
          role?: UserRole
          avatar_url?: string | null
          theme_preference?: ThemePreference
          timezone_preference?: TimezonePreference
          notifications_enabled?: boolean
          notification_categories?: NotificationCategory[]
          notifications_last_seen_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      notes: {
        Row: {
          id: string
          owner_id: string
          title: string
          content: string | null
          is_shared: boolean
          tags: string[]
          folder_path: string | null
          search_vector: unknown | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          title: string
          content?: string | null
          is_shared?: boolean
          tags?: string[]
          folder_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          title?: string
          content?: string | null
          is_shared?: boolean
          tags?: string[]
          folder_path?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notes_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      documents: {
        Row: {
          id: string
          owner_id: string
          file_name: string
          storage_path: string
          mime_type: string
          is_shared: boolean
          tags: string[]
          folder_path: string | null
          size: number
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          file_name: string
          storage_path: string
          mime_type: string
          is_shared?: boolean
          tags?: string[]
          folder_path?: string | null
          size: number
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          file_name?: string
          storage_path?: string
          mime_type?: string
          is_shared?: boolean
          tags?: string[]
          folder_path?: string | null
          size?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'documents_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      chat_threads: {
        Row: {
          id: string
          owner_id: string
          is_shared: boolean
          is_generating: boolean
          generation_started_at: string | null
          title: string
          model: string
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          is_shared?: boolean
          is_generating?: boolean
          generation_started_at?: string | null
          title?: string
          model?: string
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          is_shared?: boolean
          is_generating?: boolean
          generation_started_at?: string | null
          title?: string
          model?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'chat_threads_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      chat_messages: {
        Row: {
          id: string
          thread_id: string
          role: string
          content: string
          sender_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          thread_id: string
          role: string
          content: string
          sender_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          thread_id?: string
          role?: string
          content?: string
          sender_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'chat_messages_thread_id_fkey'
            columns: ['thread_id']
            isOneToOne: false
            referencedRelation: 'chat_threads'
            referencedColumns: ['id']
          }
        ]
      }
      chat_message_reactions: {
        Row: {
          id: string
          message_id: string
          user_id: string
          emoji: string
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          user_id: string
          emoji: string
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          user_id?: string
          emoji?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'chat_message_reactions_message_id_fkey'
            columns: ['message_id']
            isOneToOne: false
            referencedRelation: 'chat_messages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'chat_message_reactions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      generated_images: {
        Row: {
          id: string
          owner_id: string
          prompt: string
          storage_path: string
          model: string
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          prompt: string
          storage_path: string
          model: string
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          prompt?: string
          storage_path?: string
          model?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'generated_images_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      activity_events: {
        Row: {
          id: string
          actor_user_id: string
          category: NotificationCategory
          entity_type: string
          entity_id: string
          action: string
          title: string
          href: string
          created_at: string
        }
        Insert: {
          id?: string
          actor_user_id: string
          category: NotificationCategory
          entity_type: string
          entity_id: string
          action: string
          title: string
          href: string
          created_at?: string
        }
        Update: {
          id?: string
          actor_user_id?: string
          category?: NotificationCategory
          entity_type?: string
          entity_id?: string
          action?: string
          title?: string
          href?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'activity_events_actor_user_id_fkey'
            columns: ['actor_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      family_chat_channels: {
        Row: {
          id: string
          owner_id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'family_chat_channels_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      family_chat_messages: {
        Row: {
          id: string
          channel_id: string
          author_id: string
          content: string | null
          image_storage_path: string | null
          image_mime_type: string | null
          created_at: string
        }
        Insert: {
          id?: string
          channel_id: string
          author_id: string
          content?: string | null
          image_storage_path?: string | null
          image_mime_type?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          channel_id?: string
          author_id?: string
          content?: string | null
          image_storage_path?: string | null
          image_mime_type?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'family_chat_messages_channel_id_fkey'
            columns: ['channel_id']
            isOneToOne: false
            referencedRelation: 'family_chat_channels'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'family_chat_messages_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      family_chat_message_reactions: {
        Row: {
          id: string
          message_id: string
          user_id: string
          emoji: string
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          user_id: string
          emoji: string
          created_at?: string
        }
        Update: {
          id?: string
          message_id?: string
          user_id?: string
          emoji?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'family_chat_message_reactions_message_id_fkey'
            columns: ['message_id']
            isOneToOne: false
            referencedRelation: 'family_chat_messages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'family_chat_message_reactions_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      invitations: {
        Row: {
          id: string
          email: string
          role: UserRole
          invited_by: string
          token: string
          accepted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          role: UserRole
          invited_by: string
          token?: string
          accepted_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          role?: UserRole
          invited_by?: string
          token?: string
          accepted_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'invitations_invited_by_fkey'
            columns: ['invited_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      app_settings: {
        Row: {
          id: boolean
          billing_openai_gpt4o_input_per_mtok: number
          billing_openai_gpt4o_output_per_mtok: number
          billing_anthropic_sonnet_input_per_mtok: number
          billing_anthropic_sonnet_output_per_mtok: number
          billing_gpt_image_15_per_image: number
          billing_gpt_image_1_per_image: number
          billing_dalle3_per_image: number
          billing_fallback_image_per_image: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          billing_openai_gpt4o_input_per_mtok?: number
          billing_openai_gpt4o_output_per_mtok?: number
          billing_anthropic_sonnet_input_per_mtok?: number
          billing_anthropic_sonnet_output_per_mtok?: number
          billing_gpt_image_15_per_image?: number
          billing_gpt_image_1_per_image?: number
          billing_dalle3_per_image?: number
          billing_fallback_image_per_image?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          billing_openai_gpt4o_input_per_mtok?: number
          billing_openai_gpt4o_output_per_mtok?: number
          billing_anthropic_sonnet_input_per_mtok?: number
          billing_anthropic_sonnet_output_per_mtok?: number
          billing_gpt_image_15_per_image?: number
          billing_gpt_image_1_per_image?: number
          billing_dalle3_per_image?: number
          billing_fallback_image_per_image?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'app_settings_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      todo_cards: {
        Row: {
          id: string
          owner_id: string
          title: string
          is_shared: boolean
          color: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          title?: string
          is_shared?: boolean
          color?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          title?: string
          is_shared?: boolean
          color?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'todo_cards_owner_id_fkey'
            columns: ['owner_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      todo_items: {
        Row: {
          id: string
          card_id: string
          text: string
          is_done: boolean
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          card_id: string
          text: string
          is_done?: boolean
          position?: number
          created_at?: string
        }
        Update: {
          id?: string
          card_id?: string
          text?: string
          is_done?: boolean
          position?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'todo_items_card_id_fkey'
            columns: ['card_id']
            isOneToOne: false
            referencedRelation: 'todo_cards'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: UserRole
    }
  }
}
