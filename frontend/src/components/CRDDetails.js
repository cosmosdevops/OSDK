import React, { useState } from 'react';
import Properties from './Properties';
import CRDBasicInfo from './CRDBasicInfo';
import CRDSelector from './CRDSelector';
import RBACPermissions from './RBACPermissions';
import WebhookConfiguration from './WebhookConfiguration';

/* Validation options by property type */
const VALIDATION_TYPES = {
  string: ['minLength', 'maxLength', 'pattern', 'enum', 'format', 'default', 'example', 'type'],
  integer: ['minimum', 'maximum', 'multipleOf', 'enum', 'format', 'default', 'example', 'type'],
  array: ['minItems', 'maxItems', 'uniqueItems', 'itemsEnum', 'itemsPattern', 'itemsFormat',
    'default', 'example', 'type'],
  object: ['minProperties', 'maxProperties', 'default', 'example', 'type'],
  common: ['required', 'optional'],
};

/* ---------- Main component -------------------------------------------- */

function CRDDetails({
  /* text-field state */
  group, setGroup, version, setVersion, kind, setKind, plural, setPlural,
  /* switch state */
  controller, setController, status, setStatus,
  /* rbac state */
  rbac, setRbac, addRbacPermission, updateRbacPermission, removeRbacPermission,
  /* webhook state */
  webhooks, setWebhooks, addWebhook, updateWebhook, removeWebhook,
  /* misc props */
  addNewCRD, switchCRD, crdList, currentCRDIndex,
  properties, addProperty, updateProperty, removeProperty,
  errors, touched, setTouched,
}) {


  return (

    <div style={{ overflow: 'visible' }}>
      <CRDSelector
        addNewCRD={addNewCRD}
        switchCRD={switchCRD}
        crdList={crdList}
        currentCRDIndex={currentCRDIndex}
      />
      {/* Tab Navigation */}
      <wa-tab-group active="basic">
        <wa-tab panel="basic">
          <wa-icon name="settings" slot="start"></wa-icon>
          Basic Info
        </wa-tab>
        <wa-tab panel="rbac">
          <wa-icon name="shield-check" slot="start"></wa-icon>
          RBAC Permissions
        </wa-tab>
        <wa-tab panel="webhooks">
          <wa-icon name="webhook" slot="start"></wa-icon>
          Webhooks
        </wa-tab>
        <wa-tab panel="properties">
          <wa-icon name="list" slot="start"></wa-icon>
          Properties
        </wa-tab>
        {/* Toolbar */}
        <wa-tab-panel name="basic">
          {/* CRD Basic Information */}
          <CRDBasicInfo
            group={group} setGroup={setGroup}
            version={version} setVersion={setVersion}
            kind={kind} setKind={setKind}
            plural={plural} setPlural={setPlural}
            controller={controller} setController={setController}
            status={status} setStatus={setStatus}
            errors={errors}
            touched={touched}
            setTouched={setTouched}
          />
        </wa-tab-panel>

        <wa-tab-panel name="rbac">
          <RBACPermissions
            rbac={rbac}
            addRbacPermission={addRbacPermission}
            updateRbacPermission={updateRbacPermission}
            removeRbacPermission={removeRbacPermission}
          />
        </wa-tab-panel>

        <wa-tab-panel name="webhooks">
          <WebhookConfiguration
            webhooks={webhooks}
            setWebhooks={setWebhooks}
            addWebhook={addWebhook}
            updateWebhook={updateWebhook}
            removeWebhook={removeWebhook}
            version={version}
            kind={kind}
            errors={errors}
            touched={touched}
          />
        </wa-tab-panel>

        <wa-tab-panel name="properties">
          <Properties
            properties={properties}
            addProperty={addProperty}
            updateProperty={updateProperty}
            removeProperty={removeProperty}
            errors={errors}
            touched={touched}
            setTouched={setTouched}
          />
        </wa-tab-panel>
      </wa-tab-group>
    </div>
  );
}

export default CRDDetails;