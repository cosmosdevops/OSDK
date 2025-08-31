import React, { useEffect, useRef } from 'react';
import { Popover, LabeledInput, LabeledSelect } from './uiUtils';

const WEBHOOK_FIELDS = [
  {
    key: 'webhooktype', label: 'Webhook Type',
    help: '<p><b>Webhook Type:</b> Mutating webhooks can modify objects, Validating webhooks can only accept or reject them, Conversion webhooks handle version conversions.</p>'
  },
  {
    key: 'webhookpath', label: 'Webhook Path',
    help: '<p><b>Webhook Path:</b> The HTTP path where the webhook server will receive admission requests. Should be unique per webhook.</p>'
  },
  {
    key: 'webhookfailurepolicy', label: 'Failure Policy',
    help: '<p><b>Failure Policy:</b> Determines what happens if the webhook is unavailable. "Fail" rejects the request, "Ignore" allows it to proceed.</p>'
  },
  {
    key: 'webhooksideeffects', label: 'Side Effects',
    help: '<p><b>Side Effects:</b> Indicates whether the webhook has side effects. "None" means no side effects, "NoneOnDryRun" means side effects only on actual requests.</p>'
  },
  {
    key: 'webhookmatchpolicy', label: 'Match Policy',
    help: '<p><b>Match Policy:</b> Determines how to match requests. "Exact" requires exact match, "Equivalent" allows semantically equivalent matches.</p>'
  },
  {
    key: 'webhookoperations', label: 'Operations',
    help: '<p><b>Operations:</b> The Kubernetes operations this webhook should intercept (CREATE, UPDATE, DELETE).</p>'
  },
  {
    key: 'webhookresources', label: 'Resources',
    help: '<p><b>Resources:</b> The Kubernetes resource types this webhook should watch (e.g., pods, deployments, services).</p>'
  },
];

// Wrapper for wa-checkbox to sync the 'checked' property on first render
function WACheckbox({ checked, onChange, children, ...rest }) {
  const ref = useRef(null);
  // Sync after each render when 'checked' changes (custom elements need property set, not only attribute because react is dumb)
  useEffect(() => {
    if (ref.current && ref.current.checked !== checked) {
      ref.current.checked = checked;
    }
  }, [checked]);
  // Also run once after mount to catch upgrade timing of custom element
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (ref.current && ref.current.checked !== checked) {
        ref.current.checked = checked;
      }
    });
    return () => cancelAnimationFrame(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <wa-checkbox ref={ref} checked={checked} onChange={onChange} {...rest}>
      {children}
    </wa-checkbox>
  );
}

function WebhookConfiguration({
  webhooks, setWebhooks, addWebhook, updateWebhook, removeWebhook,
  version, kind, errors, touched
}) {
  // Helper function to generate webhook paths based on type, version, and kind
  const generateWebhookPath = (webhookType, crdVersion, crdKind) => {
    const kindLower = crdKind.toLowerCase();
    const versionLower = crdVersion.toLowerCase();

    switch (webhookType) {
      case 'mutating':
        return `/mutate-${versionLower}-${kindLower}`;
      case 'validating':
        return `/validate-${versionLower}-${kindLower}`;
      case 'conversion':
        return `/convert-${versionLower}-${kindLower}`;
      default:
        return `/mutate-${versionLower}-${kindLower}`;
    }
  };

  // Update webhook paths when kind or version changes
  useEffect(() => {
    if (webhooks && webhooks.length > 0 && kind && version) {
      const updatedWebhooks = webhooks.map(webhook => ({
        ...webhook,
        path: generateWebhookPath(webhook.type || 'mutating', version, kind)
      }));

      // Only update if there are actual changes
      const hasChanges = webhooks.some((webhook, idx) =>
        webhook.path !== updatedWebhooks[idx].path
      );

      if (hasChanges) {
        setWebhooks(updatedWebhooks);
      }
    }
  }, [kind, version, webhooks, setWebhooks]);

  // (Removed imperative sync effect; handled in WACheckbox component)

  return (
    <div style={{ marginTop: '1.5rem' }}>
      {/* Pop-overs for webhook fields */}
      {WEBHOOK_FIELDS.map(f => (
        <Popover key={f.key} id={`popover__${f.key}`}>
          <p dangerouslySetInnerHTML={{ __html: f.help }} />
        </Popover>
      ))}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <h3 style={{ margin: 0 }}>Webhook Configuration</h3>
      </div>
      <p style={{ fontSize: '0.9rem', color: '#868686ff', marginBottom: '1rem' }}>
        Configure Webhooks to manage incoming CR requests for this CRD.
      </p>
      <div style={{ paddingLeft: '1rem', borderLeft: '3px solid #e0e0e0', overflow: 'visible' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <h4 style={{ margin: 0 }}>Admission Webhooks</h4>
          <wa-button
            variant="brand"
            appearance="filled"
            size="small"
            onClick={addWebhook}
            style={{ marginLeft: 'auto' }}
          >
            Add Webhook
          </wa-button>
        </div>

        {webhooks?.map((webhook, idx) => (
          <div key={idx} style={{
            marginBottom: '1.5rem',
            padding: '0.75rem',
            border: '1px solid #e0e0e0',
            borderRadius: '6px',
            overflow: 'visible'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', overflow: 'visible' }}>
              <LabeledSelect
                id={`webhooktype-${idx}`}
                label={WEBHOOK_FIELDS.find(f => f.key === 'webhooktype')?.label}
                value={webhook.type || 'mutating'}
                onChange={e => {
                  const newType = e.target.value;
                  updateWebhook(idx, 'type', newType);

                  // Auto-update path based on webhook type
                  const newPath = generateWebhookPath(newType, version, kind);
                  updateWebhook(idx, 'path', newPath);
                }}
              >
                <wa-option value="mutating">Mutating Webhook</wa-option>
                <wa-option value="validating">Validating Webhook</wa-option>
                <wa-option value="conversion">Conversion Webhook</wa-option>
              </LabeledSelect>
              <wa-button
                variant="danger"
                size="small"
                onClick={() => removeWebhook(idx)}
                style={{ marginLeft: 'auto' }}
              >
                Remove
              </wa-button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem', overflow: 'visible', position: 'static' }}>
              <LabeledInput
                id={`webhookpath-${idx}`}
                label={WEBHOOK_FIELDS.find(f => f.key === 'webhookpath')?.label}
                placeholder="Webhook Path (e.g., /mutate-v1-pod)"
                value={webhook.path || ''}
                onChange={e => updateWebhook(idx, 'path', e.target.value)}
                touched={touched[`webhookpath-${idx}`]}
                error={errors[`webhookpath-${idx}`]}
              />
              <LabeledSelect
                id={`webhookfailurepolicy-${idx}`}
                label={WEBHOOK_FIELDS.find(f => f.key === 'webhookfailurepolicy')?.label}
                value={webhook.failurePolicy || 'Fail'}
                onChange={e => updateWebhook(idx, 'failurePolicy', e.target.value)}
              >
                <wa-option value="Fail">Fail on Error</wa-option>
                <wa-option value="Ignore">Ignore Errors</wa-option>
              </LabeledSelect>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem', overflow: 'visible', position: 'static' }}>
              <LabeledSelect
                id={`webhooksideeffects-${idx}`}
                label={WEBHOOK_FIELDS.find(f => f.key === 'webhooksideeffects')?.label}
                value={webhook.sideEffects || 'None'}
                onChange={e => updateWebhook(idx, 'sideEffects', e.target.value)}
              >
                <wa-option value="None">None</wa-option>
                <wa-option value="NoneOnDryRun">None on Dry Run</wa-option>
                <wa-option value="Some">Some</wa-option>
                <wa-option value="Unknown">Unknown</wa-option>
              </LabeledSelect>
              <LabeledSelect
                id={`webhookmatchpolicy-${idx}`}
                label={WEBHOOK_FIELDS.find(f => f.key === 'webhookmatchpolicy')?.label}
                value={webhook.matchPolicy || 'Exact'}
                onChange={e => updateWebhook(idx, 'matchPolicy', e.target.value)}
              >
                <wa-option value="Exact">Exact Match</wa-option>
                <wa-option value="Equivalent">Equivalent Match</wa-option>
              </LabeledSelect>
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                  {WEBHOOK_FIELDS.find(f => f.key === 'webhookoperations')?.label}:
                </label>
                <wa-icon id="popover__webhookoperations" variant="regular" name="circle-question"
                  style={{ cursor: 'pointer' }} />
              </div>
              <form style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {['CREATE', 'UPDATE', 'DELETE'].map(op => {
                  const normalizedOps = (webhook.operations || [])
                    .map(o => (typeof o === 'string' ? o.trim().toUpperCase() : ''))
                    .filter(o => o);
                  const isChecked = normalizedOps.includes(op);
                  const handleChange = e => {
                    const current = (webhook.operations || [])
                      .map(o => (typeof o === 'string' ? o.trim().toUpperCase() : ''))
                      .filter(o => o);
                    let next;
                    if (e.target.checked) {
                      next = Array.from(new Set([...current, op]));
                    } else {
                      next = current.filter(o => o !== op);
                    }
                    updateWebhook(idx, 'operations', next);
                  };
                  return (
                    <WACheckbox
                      key={`${idx}-${op}`}
                      data-webhook-idx={idx}
                      data-op={op}
                      checked={isChecked}
                      onChange={handleChange}
                    >
                      {op}
                    </WACheckbox>
                  );
                })}
              </form>
            </div>

            <div style={{ marginBottom: '0.75rem' }}>
              <LabeledInput
                id={`webhookresources-${idx}`}
                label={WEBHOOK_FIELDS.find(f => f.key === 'webhookresources')?.label}
                placeholder="e.g., pods, deployments"
                value={webhook.resources?.join(', ') || ''}
                onChange={e => {
                  const resources = e.target.value
                    .split(',')
                    .map(r => r.trim())
                    .filter(r => r.length > 0);
                  updateWebhook(idx, 'resources', resources);
                }}
              />
            </div>
          </div>
        ))}

        {webhooks?.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '2rem',
            color: '#666',
            fontStyle: 'italic'
          }}>
            No webhooks configured. Click "Add Webhook" to get started.
          </div>
        )}
      </div>
    </div>
  );
}

export default WebhookConfiguration;
