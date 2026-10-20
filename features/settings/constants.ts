import { PERMISSIONS, type PermissionKey } from "@/lib/constants/permissions";

/** These stay with HR Admins only, so nobody else can grant themselves more access or read the audit trail. */
export const ADMIN_ONLY_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.USER_MANAGE,
  PERMISSIONS.ROLE_MANAGE,
  PERMISSIONS.AUDIT_READ,
];
