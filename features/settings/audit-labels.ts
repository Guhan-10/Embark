/** Plain-English names for audit actions. Anything missing falls back to a tidied version of the key. */
const ACTION_LABELS: Record<string, string> = {
  "employee.create": "Added employee",
  "employee.update": "Edited employee",
  "employee.archive": "Archived employee",
  "employee.restore": "Restored employee",
  "employee.invite": "Sent welcome email",
  "user.register": "Created their login",
  "user.activate": "Turned login on",
  "user.deactivate": "Turned login off",
  "user.sign_out_everywhere": "Signed out everywhere",
  "role.permissions": "Changed role permissions",
  "department.create": "Added department",
  "department.update": "Edited department",
  "department.delete": "Deleted department",
  "department.set_hr": "Changed department HR",
  "document.upload": "Uploaded document",
  "document.approve": "Approved document",
  "document.reject": "Rejected document",
  "document.delete": "Removed document",
  "document.download": "Downloaded document",
  "document.expire": "Document expired",
  "document_type.create": "Added document type",
  "document_type.update": "Edited document type",
  "document_type.delete": "Deleted document type",
  "onboarding.start": "Started onboarding",
  "onboarding.cancel": "Cancelled onboarding",
  "task.create": "Added task",
  "task.update": "Edited task",
  "task.assign": "Reassigned task",
  "task.status": "Changed task status",
  "template.create": "Added template",
  "template.update": "Edited template",
  "report.export": "Exported report",
};

const ENTITY_LABELS: Record<string, string> = {
  Department: "Department",
  Document: "Document",
  DocumentType: "Document type",
  Employee: "Employee",
  OnboardingProcess: "Onboarding",
  OnboardingTask: "Task",
  OnboardingTemplate: "Template",
  Report: "Report",
  Role: "Role",
  User: "Login",
};

/** Where a record lives in the app, when it has its own page. */
const ENTITY_PATHS: Record<string, (id: string) => string> = {
  Employee: (id) => `/employees/${id}`,
  Document: (id) => `/documents/${id}`,
  OnboardingProcess: (id) => `/onboarding/${id}`,
  OnboardingTask: (id) => `/tasks/${id}`,
  OnboardingTemplate: (id) => `/onboarding/templates/${id}`,
};

export function auditActionLabel(action: string) {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  const text = action.replace(/[._]/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function auditEntityLabel(entityType: string) {
  return ENTITY_LABELS[entityType] ?? entityType;
}

export function auditEntityHref(entityType: string, entityId: string | null) {
  return entityId && ENTITY_PATHS[entityType] ? ENTITY_PATHS[entityType](entityId) : null;
}
