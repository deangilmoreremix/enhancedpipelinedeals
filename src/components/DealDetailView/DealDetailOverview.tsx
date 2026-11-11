import React from 'react';
import { Link } from 'react-router-dom';
import { User, Mail, Phone, Calendar, FileText } from 'lucide-react';
import { DealDetailOverviewProps } from './types';
import { daysSince } from '../../utils/dateUtils';
import { initialsAvatar } from '../../utils/avatar';
import { formatMoney } from '../../utils/currencyMicros';
import {
  CompanyPicker, ContactRelationField, CurrencyField, DateField, OwnerPicker, PRIORITY_OPTIONS, SelectField, StageField, TextField,
} from '../deals/fields';
import { RelatedCompanyCard } from './RelatedRecordCards';
import { DealAIAssist } from '../deals/DealAIAssist';
import { usePermissions } from '../../hooks/usePermissions';
import StaleDealIndicator from '../deals/StaleDealIndicator';

export const DealDetailOverview: React.FC<DealDetailOverviewProps> = ({
  deal,
  editedDeal,
  linkedContact,
  onUpdateDeal,
}) => {
  const { allowed } = usePermissions();
  const readOnly = !allowed('edit', 'deal', editedDeal);
  const currencyCode = editedDeal.currencyCode ?? 'USD';

  // Calculate days in current stage and total active days
  const daysInStage = daysSince(editedDeal.updatedAt);
  const daysActive = daysSince(editedDeal.createdAt);

  return (
    <div className="p-6 space-y-6">
      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
          <p className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wide mb-1">Deal Value</p>
          <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{formatMoney(editedDeal.value, currencyCode)}</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Expected revenue</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-xl p-4 border border-green-200 dark:border-green-700">
          <p className="text-xs font-medium text-green-700 dark:text-green-300 uppercase tracking-wide mb-1">Probability</p>
          <p className="text-2xl font-bold text-green-900 dark:text-green-100">{editedDeal.probability}%</p>
          <p className="text-xs text-green-600 dark:text-green-400 mt-1">Close confidence</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 rounded-xl p-4 border border-purple-200 dark:border-purple-700">
          <p className="text-xs font-medium text-purple-700 dark:text-purple-300 uppercase tracking-wide mb-1">Days in Stage</p>
          <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{daysInStage}</p>
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Current stage time</p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/30 rounded-xl p-4 border border-orange-200 dark:border-orange-700">
          <p className="text-xs font-medium text-orange-700 dark:text-orange-300 uppercase tracking-wide mb-1">Days Active</p>
          <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">{daysActive}</p>
          <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Total deal age</p>
        </div>
      </div>

      {/* Deal fields (click to edit; Enter/blur saves, Esc cancels) */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <TextField
          label="Title"
          disabled={readOnly}
          value={editedDeal.title ?? ''}
          required
          placeholder="Untitled deal"
          displayClassName="text-lg font-semibold"
          onSave={title => onUpdateDeal({ title })}
          className="mb-5"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
          <StageField disabled={readOnly} label="Stage" value={editedDeal.stage} onSave={stage => onUpdateDeal({ stage })} />
          <SelectField disabled={readOnly} label="Priority" value={editedDeal.priority} options={PRIORITY_OPTIONS} onSave={priority => onUpdateDeal({ priority: priority as typeof editedDeal.priority })} />
          <CurrencyField
            label="Amount"
            disabled={readOnly}
            value={editedDeal.value}
            currencyCode={currencyCode}
            onSave={({ value, currencyCode: code }) => onUpdateDeal({ value, currencyCode: code })}
          />
          <DateField disabled={readOnly} label="Close date" value={editedDeal.closeDate} onSave={d => onUpdateDeal({ closeDate: d ?? undefined })} />
          <CompanyPicker
            fieldLabel="Company"
            disabled={readOnly}
            value={editedDeal.companyId}
            label={editedDeal.company}
            onChange={(companyId, company) =>
              // null clears the column (the mapper skips undefined keys); company text stays in sync
              onUpdateDeal({ companyId: (companyId ?? null) as unknown as string | undefined, company })
            }
          />
          <ContactRelationField
            label="Contact"
            disabled={readOnly}
            contactId={editedDeal.contactId}
            contactName={editedDeal.contact}
            onSave={({ contactId, contact }) =>
              // null clears the column (the mapper skips undefined keys)
              onUpdateDeal({ contactId: (contactId ?? null) as unknown as string | undefined, contact })
            }
          />
          <OwnerPicker
            fieldLabel="Owner"
            disabled={readOnly || !allowed('assign', 'deal', editedDeal)}
            value={editedDeal.ownerId ?? editedDeal.assignedToId}
            label={editedDeal.assignedTo}
            onChange={(ownerId, name) =>
              onUpdateDeal({
                ownerId: (ownerId ?? null) as unknown as string | undefined,
                assignedToId: (ownerId ?? null) as unknown as string | undefined,
                assignedTo: (name || null) as unknown as string | undefined,
              })
            }
          />
          <DateField disabled={readOnly} label="Due date" value={editedDeal.dueDate} onSave={d => onUpdateDeal({ dueDate: d ?? undefined })} />
        </div>
      </div>

      <StaleDealIndicator deal={editedDeal} />

      <RelatedCompanyCard deal={editedDeal} onLinked={c => void onUpdateDeal({ companyId: c.id })} />

      {/* Contact Information Card */}
      {linkedContact && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <User className="w-5 h-5 mr-2 text-blue-500 dark:text-blue-400" />
            Contact Information
          </h4>

          <div className="flex items-start space-x-4 mb-4">
            <img
              src={linkedContact.avatarSrc || initialsAvatar(linkedContact.name)}
              alt={linkedContact.name}
              className="w-16 h-16 rounded-lg border-2 border-gray-200 dark:border-gray-600 shadow-sm"
            />

            <div className="flex-1">
              <h5 className="text-xl font-semibold mb-1">
                <Link to={`/contacts/${linkedContact.id}`} className="text-gray-900 hover:text-blue-600 hover:underline dark:text-white dark:hover:text-blue-400">{linkedContact.name}</Link>
              </h5>
              <p className="text-gray-600 dark:text-gray-300 mb-2">{linkedContact.title} at {linkedContact.company}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</p>
                  <a href={`mailto:${linkedContact.email}`} className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
                    {linkedContact.email}
                  </a>
                </div>
                {linkedContact.phone && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Phone</p>
                    <a href={`tel:${linkedContact.phone}`} className="text-blue-600 dark:text-blue-400 hover:underline text-sm">
                      {linkedContact.phone}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Contact Quick Actions */}
          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors text-sm font-medium">
              <Mail className="w-4 h-4" />
              <span>Email</span>
            </button>
            <button className="flex items-center justify-center space-x-2 px-4 py-2 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors text-sm font-medium">
              <Phone className="w-4 h-4" />
              <span>Call</span>
            </button>
            <button className="flex items-center justify-center space-x-2 px-4 py-2 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors text-sm font-medium">
              <Calendar className="w-4 h-4" />
              <span>Meeting</span>
            </button>
          </div>
        </div>
      )}

      {/* Deal summary */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center mb-3">
          <FileText className="w-5 h-5 mr-2 text-gray-600 dark:text-gray-400" />
          Deal Summary
        </h4>
        <TextField
          multiline
          disabled={readOnly}
          label="Summary"
          value={editedDeal.notes ?? ''}
          placeholder="Add a short summary of this deal. Use the Notes tab for rich, timestamped notes."
          onSave={notes => onUpdateDeal({ notes })}
        />
      </div>

      <DealAIAssist dealId={deal.id} />
    </div>
  );
};
