import React from 'react';

const VALIDATION_TYPES = {
  string : ['minLength','maxLength','pattern','enum','format','default','example','type'],
  integer: ['minimum','maximum','multipleOf','enum','format','default','example','type'],
  array  : ['minItems','maxItems','uniqueItems','itemsEnum','itemsPattern','itemsFormat',
            'default','example','type'],
  object : ['minProperties','maxProperties','default','example','type'],
  common : ['required','optional'],
};

function Properties({ properties, addProperty, updateProperty, removeProperty, errors, touched, setTouched }) {
  return (
    <div style={{marginTop:'1.5rem'}}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0 }}>Properties</h3>
        <wa-button 
          variant="brand" 
          appearance="filled" 
          size="small"
          onClick={addProperty}
          style={{ marginLeft: 'auto' }}
        >
          Add Property
        </wa-button>
      </div>
      {properties.map((prop, idx) => {
        const propErr = errors.properties?.[idx] ?? {};
        const propTouch = touched.properties?.[idx] ?? {};
        const changeProp = (field, value) => updateProperty(idx, field, value);
        const validationOptions = [
          ...(VALIDATION_TYPES[prop.type] ?? []),
          ...VALIDATION_TYPES.common,
        ];
        return (
          <div key={idx} style={{marginBottom:'1.5rem',padding:'0.75rem',
                                 border:'1px solid #e0e0e0',borderRadius:'6px'}}>
            {/* name + type */}
            <wa-input
              placeholder="Property name"
              value={prop.name}
              onInput={e => {
                changeProp('name', e.target.value);
                setTouched(t => ({...t, properties:{
                  ...t.properties, [idx]: {...propTouch, name:true}}}));
              }}
              with-clear
              invalid={!!propErr.name && propTouch.name}
            />
            {propErr.name && propTouch.name && <span className="error-text">{propErr.name}</span>}
            <select
              value={prop.type}
              onChange={e => {
                changeProp('type', e.target.value);
                changeProp('validations', []);
                setTouched(t => ({...t, properties:{
                  ...t.properties, [idx]: {...propTouch, type:true}}}));
              }}
              style={propErr.type && propTouch.type ? {borderColor:'red'} : {}}
            >
              <option value="">Select Type</option>
              {['string','integer','boolean','array','object']
                .map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {propErr.type && propTouch.type && <span className="error-text">{propErr.type}</span>}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <wa-button variant="brand" appearance="filled" size="small"
                         onClick={() => changeProp('showValidation', !prop.showValidation)}>
                {prop.showValidation ? 'Hide Validations' : 'Show Validations'}
              </wa-button>
              <wa-button variant="danger" size="small"
                         onClick={() => removeProperty(idx)}>
                Remove
              </wa-button>
            </div>
            {/* Validation editor */}
            {prop.showValidation && (
              <div style={{marginTop:'0.75rem',marginLeft:'0.5rem',
                          padding:'0.75rem',borderRadius:'6px'}}>
                {prop.validations?.map((val, vIdx) => (
                  <div key={vIdx} style={{display:'flex',alignItems:'center',marginBottom:'0.5rem'}}>
                    {/* type selector */}
                    <select
                      style={{width:'160px',marginRight:'0.5rem'}}
                      value={val.type}
                      onChange={e => {
                        const updated = [...prop.validations];
                        updated[vIdx].type = e.target.value;
                        changeProp('validations', updated);
                      }}>
                      {validationOptions.map(opt =>
                        <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                    {/* value input – only render if needed */}
                    {(() => {
                      const needsNumber = ['minLength','maxLength','minimum','maximum',
                                           'minItems','maxItems','minProperties','maxProperties','multipleOf']
                                           .includes(val.type);
                      const needsText   = ['pattern','itemsPattern','default','example','type'].includes(val.type);
                      const needsEnum   = ['enum','itemsEnum'].includes(val.type);
                      const needsFormat = ['format','itemsFormat'].includes(val.type);
                      const needsBool   = ['uniqueItems','exclusiveMinimum','exclusiveMaximum',
                                           'required','optional'].includes(val.type);
                      if (needsNumber || needsText || needsEnum) {
                        const ph = needsEnum ? 'comma,separated' : val.type;
                        return (
                          <wa-input
                            type={needsNumber ? 'number' : 'text'}
                            style={{width: needsNumber ? '120px' : '220px',marginRight:'0.5rem'}}
                            value={val.value ?? ''}
                            placeholder={ph}
                            onInput={e => {
                              const updated=[...prop.validations];
                              updated[vIdx].value=e.target.value;
                              changeProp('validations',updated);
                            }}
                            with-clear />
                        );
                      }
                      if (needsFormat) {
                        const opts = prop.type === 'string'
                          ? ['', 'date-time','email','uuid','uri']
                          : ['', 'int32','int64'];
                        return (
                          <select
                            style={{width:'140px',marginRight:'0.5rem'}}
                            value={val.value ?? ''}
                            onChange={e => {
                              const updated=[...prop.validations];
                              updated[vIdx].value=e.target.value;
                              changeProp('validations',updated);
                            }}>
                            {opts.map(o => <option key={o} value={o}>{o || 'No format'}</option>)}
                          </select>
                        );
                      }
                      if (needsBool) {
                        return (
                          <select
                            style={{width:'100px',marginRight:'0.5rem'}}
                            value={val.value === undefined ? '' : String(val.value)}
                            onChange={e => {
                              const updated=[...prop.validations];
                              updated[vIdx].value=e.target.value === 'true';
                              changeProp('validations',updated);
                            }}>
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </select>
                        );
                      }
                      return null;
                    })()}
                    <wa-button
                      variant="danger"
                      size="small"
                      style={{ marginLeft: '0.5rem', color: '#e96270ff', borderColor: '#e96270ff' }}
                      onClick={() => {
                        const updated = [...prop.validations];
                        updated.splice(vIdx, 1);
                        changeProp('validations', updated);
                      }}>
                      Remove
                    </wa-button>
                  </div>
                ))}
                {/* Add validation */}
                <wa-button variant="brand" appearance="filled" size="small" style={{marginTop:'0.5rem'}}
                           onClick={()=>{
                             const updated=[...(prop.validations||[])];
                             const first = VALIDATION_TYPES[prop.type]?.[0] || '';
                             updated.push({type:first,value:''});
                             changeProp('validations',updated);
                           }}>
                  + Add Validation
                </wa-button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default Properties;
