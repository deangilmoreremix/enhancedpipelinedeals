import React, { useEffect, useState } from 'react';
import { EmailIntegrationPanel } from '../components/email/EmailIntegrationPanel';
import { EmailThreadViewer } from '../components/email/EmailThreadViewer';
import { useContactStore } from '../store/contactStore';
import { PageContainer, PageHeader } from './PageHeader';
import { useDeals } from './hooks';

const EmailPage: React.FC = () => {
  const { deals } = useDeals();
  const contacts = useContactStore(s => s.contacts);
  const fetchContacts = useContactStore(s => s.fetchContacts);
  const [record, setRecord] = useState(''); // "deal:<id>" | "contact:<id>"

  useEffect(() => {
    if (useContactStore.getState().contacts.length === 0) void fetchContacts();
  }, [fetchContacts]);

  const [kind, id] = record.split(':') as ['deal' | 'contact' | '', string];

  return (
    <PageContainer>
      <PageHeader title="Email" subtitle="Threads linked to your deals and contacts" />
      <div className="mb-6">
        <label className="text-sm font-medium mr-3" htmlFor="email-record">Record</label>
        <select
          id="email-record"
          value={record}
          onChange={e => setRecord(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-sm"
        >
          <option value="">Select a deal or contact</option>
          <optgroup label="Deals">
            {Object.values(deals).map(d => (
              <option key={d.id} value={`deal:${d.id}`}>{d.title || d.company}</option>
            ))}
          </optgroup>
          <optgroup label="Contacts">
            {contacts.map(c => (
              <option key={c.id} value={`contact:${c.id}`}>{c.name}</option>
            ))}
          </optgroup>
        </select>
      </div>
      {kind && id ? (
        <div className="space-y-8">
          <EmailIntegrationPanel recordType={kind} recordId={id} />
          <EmailThreadViewer recordType={kind} recordId={id} />
        </div>
      ) : (
        <EmailThreadViewer />
      )}
    </PageContainer>
  );
};

export default EmailPage;
