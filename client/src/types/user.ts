export type UserRole =
  | "admin"
  | "manager"
  | "sales"
  | "staff"
  | "superAdmin";

export interface User {
  _id: string;
  id?: string;
  name: string;
  email: string;
  role: UserRole;
  franchise?: string;
  isActive?: boolean;
  lastLogin?: string;
}
