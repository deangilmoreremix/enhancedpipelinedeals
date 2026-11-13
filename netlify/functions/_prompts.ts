/** Contact line for system prompts; never prints "undefined" for missing fields. */
export function describeContact(contact: { name?: string | null; company?: string | null } | null | undefined): string {
  if (!contact) return 'Contact: (unknown contact; do not invent details)';
  const name = contact.name || 'the contact';
  return contact.company ? `Contact: ${name} at ${contact.company}` : `Contact: ${name}`;
}
