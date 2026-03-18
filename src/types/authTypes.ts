import type { User } from "./userTypes"

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  firstName: string
  lastName: string
  email: string
  password: string
}

export interface AuthResponse {
  token: string
  id: number
  firstName: string
  lastName: string
  email: string
  role: 'USER' | 'ADMIN'
}

export interface MeResponse {
  authenticated: boolean
  user: User | null
}

export interface RecoverRequestPayload {
  email: string
}

export interface RecoverResetPayload {
  token: string
  newPassword: string
  confirmPassword: string
}