import { createClient } from '@/lib/supabase/client'

// Database types based on our schema
export interface Profile {
  id: string
  email: string
  name: string | null
  role: 'admin' | 'operator' | 'viewer'
  avatar_url: string | null
  created_at: string
  updated_at: string
  last_login: string | null
}

export interface Setting {
  id: string
  key: string
  value: Record<string, unknown>
  user_id: string | null
  created_at: string
  updated_at: string
}

export interface Subscription {
  id: string
  room_email: string
  graph_subscription_id: string | null
  resource: string
  expires_at: string
  status: 'active' | 'expired' | 'error'
  notification_url: string | null
  client_state: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  booking_id: string
  room_email: string
  room_name: string
  organizer_email: string
  organizer_name: string
  subject: string
  outcome: 'accepted' | 'declined' | 'tentative' | 'pending'
  notification_type: string
  sent_at: string | null
  delivered: boolean
  error_message: string | null
  template_used: string | null
  variables: Record<string, unknown> | null
  created_at: string
}

export interface RoomPolicy {
  id: string
  room_email: string
  room_name: string
  site: string
  auto_accept: boolean
  require_approval: boolean
  max_duration_minutes: number | null
  allowed_hours_start: string | null
  allowed_hours_end: string | null
  notification_emails: string[]
  custom_rules: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface TestVariable {
  key: string
  value: string
  description?: string
}

// Database operations
export const db = {
  // Profiles
  profiles: {
    async getAll() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Profile[]
    },

    async getById(id: string) {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Profile
    },

    async update(id: string, updates: Partial<Profile>) {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Profile
    },

    async create(profile: Omit<Profile, 'created_at' | 'updated_at'>) {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('profiles')
        .insert(profile)
        .select()
        .single()
      if (error) throw error
      return data as Profile
    },

    async delete(id: string) {
      const supabase = createClient()
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
  },

  // Settings
  settings: {
    async get(key: string, userId?: string) {
      const supabase = createClient()
      let query = supabase
        .from('settings')
        .select('*')
        .eq('key', key)
      
      if (userId) {
        query = query.eq('user_id', userId)
      } else {
        query = query.is('user_id', null)
      }

      const { data, error } = await query.single()
      if (error && error.code !== 'PGRST116') throw error // PGRST116 = not found
      return data as Setting | null
    },

    async set(key: string, value: Record<string, unknown>, userId?: string) {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('settings')
        .upsert({
          key,
          value,
          user_id: userId || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: userId ? 'key,user_id' : 'key',
        })
        .select()
        .single()
      if (error) throw error
      return data as Setting
    },

    async getAll() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .is('user_id', null) // Global settings only
      if (error) throw error
      return data as Setting[]
    },
  },

  // Subscriptions
  subscriptions: {
    async getAll() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Subscription[]
    },

    async create(subscription: Omit<Subscription, 'id' | 'created_at' | 'updated_at'>) {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('subscriptions')
        .insert(subscription)
        .select()
        .single()
      if (error) throw error
      return data as Subscription
    },

    async update(id: string, updates: Partial<Subscription>) {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('subscriptions')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Subscription
    },

    async delete(id: string) {
      const supabase = createClient()
      const { error } = await supabase
        .from('subscriptions')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
  },

  // Notifications
  notifications: {
    async getAll(limit = 100) {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data as Notification[]
    },

    async create(notification: Omit<Notification, 'id' | 'created_at'>) {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('notifications')
        .insert(notification)
        .select()
        .single()
      if (error) throw error
      return data as Notification
    },

    async markDelivered(id: string) {
      const supabase = createClient()
      const { error } = await supabase
        .from('notifications')
        .update({ delivered: true, sent_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },

    async markFailed(id: string, errorMessage: string) {
      const supabase = createClient()
      const { error } = await supabase
        .from('notifications')
        .update({ delivered: false, error_message: errorMessage })
        .eq('id', id)
      if (error) throw error
    },
  },

  // Room Policies
  roomPolicies: {
    async getAll() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('room_policies')
        .select('*')
        .order('room_name', { ascending: true })
      if (error) throw error
      return data as RoomPolicy[]
    },

    async getByRoomEmail(roomEmail: string) {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('room_policies')
        .select('*')
        .eq('room_email', roomEmail)
        .single()
      if (error && error.code !== 'PGRST116') throw error
      return data as RoomPolicy | null
    },

    async upsert(policy: Omit<RoomPolicy, 'id' | 'created_at' | 'updated_at'>) {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('room_policies')
        .upsert({
          ...policy,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'room_email',
        })
        .select()
        .single()
      if (error) throw error
      return data as RoomPolicy
    },
  },
}
