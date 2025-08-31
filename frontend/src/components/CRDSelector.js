import React, { useEffect, useLayoutEffect, useRef } from 'react';

function CRDSelector({ addNewCRD, switchCRD, crdList, currentCRDIndex }) {
  
  // Ensure currentCRDIndex defaults to 0 if it's not set and we have CRDs
  const safeCurrentCRDIndex = (currentCRDIndex != null && currentCRDIndex >= 0 && currentCRDIndex < crdList.length) 
    ? currentCRDIndex 
    : (crdList.length > 0 ? 0 : -1);


  useEffect(() => {

    if (crdList.length > 0 && (currentCRDIndex == null || currentCRDIndex < 0 || currentCRDIndex >= crdList.length)) {
      switchCRD(0);
    }
  }, [crdList.length, currentCRDIndex, switchCRD]);
  const selectRef = useRef(null);

  // Keep the custom element's value in sync (before paint to avoid flicker)
  useLayoutEffect(() => {
    if (!selectRef.current) return;
    const desired = String(safeCurrentCRDIndex);
    // Set the value property (custom element) and also selected on child options
    if (selectRef.current.value !== desired) {
      selectRef.current.value = desired;
    }
    const options = selectRef.current.querySelectorAll('wa-option');
    options.forEach(opt => {
      const match = opt.getAttribute('value') === desired;
      if (opt.selected !== match) {
        opt.selected = match;
      }
    });
  }, [safeCurrentCRDIndex, crdList.length]);

  return (
    <div className="wa-stack">
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <wa-button variant="brand" appearance="filled" size="small" onClick={addNewCRD}>
          Add New CRD
        </wa-button>

  <wa-select ref={selectRef} value={String(safeCurrentCRDIndex)} onChange={e => switchCRD(Number(e.target.value))}>
          {crdList.map((crd, i) => {
            const isSelected = i === safeCurrentCRDIndex;
            
            return (
              <wa-option
                key={`crd-${i}-${crd.kind}`}
                value={String(i)}
    selected={isSelected}
              >
                {`CRD ${i + 1}: ${crd.kind || 'Unnamed'}`}
              </wa-option>
            );
          })}
        </wa-select>
      </div>
    </div>
  );
}

export default CRDSelector;