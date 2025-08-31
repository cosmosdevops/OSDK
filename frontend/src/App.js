import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import './App.css';
import GeneralInfo from './components/GeneralInfo';
import CRDDetails from './components/CRDDetails';

function App() {
  const [domain, setDomain] = useState('');
  const [repo, setRepo] = useState('');
  const [projectName, setProjectName] = useState('');
  const [namespaced, setNamespaced] = useState(false); // Toggle for UI
  const [namespaces, setNamespaces] = useState(''); // Comma-separated input
  const [sharedStepComplete, setSharedStepComplete] = useState(false);
  const [crds, setCrds] = useState([createNewCRD()]);
  const [currentCRDIndex, setCurrentCRDIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false); // Loading state for generation
  const [downloadProgress, setDownloadProgress] = useState(0); // Download progress

  const getNamespacesArray = () =>
    !namespaced || namespaces.trim() === ''
      ? []
      : namespaces.split(',').map(ns => ns.trim()).filter(Boolean);

  const [editorValue, setEditorValue] = useState(
    JSON.stringify({
      domain,
      repo,
      projectName,
      namespaces: getNamespacesArray(),
      crds: crds.map(crd => ({
        ...crd,
        properties: crd.properties.map(({ showValidation, ...rest }) => rest)
      }))
    }, null, 2)
  );

  useEffect(() => {
    setEditorValue(
      JSON.stringify({
        domain,
        repo,
        projectName,
        namespaces: getNamespacesArray(),
        crds: crds.map(crd => ({
          ...crd,
          properties: crd.properties.map(({ showValidation, ...rest }) => rest)
        }))
      }, null, 2)
    );
  }, [domain, repo, projectName, namespaced, namespaces, crds]);

  const downloadFile = async (response, filename) => {
    const contentLength = response.headers.get('content-length');
    const total = parseInt(contentLength, 10);
    let loaded = 0;

    const reader = response.body.getReader();
    const stream = new ReadableStream({
      start(controller) {
        function pump() {
          return reader.read().then(({ done, value }) => {
            if (done) {
              controller.close();
              return;
            }
            loaded += value.byteLength;
            if (total) {
              setDownloadProgress(Math.round((loaded / total) * 100));
            }
            controller.enqueue(value);
            return pump();
          });
        }
        return pump();
      }
    });

    const blob = await new Response(stream).blob();
    setDownloadProgress(0); // Reset progress

    if ('showSaveFilePicker' in window) {
      try {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{
            description: 'ZIP files',
            accept: { 'application/zip': ['.zip'] }
          }]
        });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return true;
      } catch (err) {
        if (err.name === 'AbortError') {
          throw new Error('Download cancelled by user');
        }
        console.warn('File System Access API failed, falling back to traditional download');
      }
    }
    
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    return true;
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    
    let data;
    try {
      data = JSON.parse(editorValue);
    } catch (error) {
      setIsGenerating(false);
      alert('Invalid JSON in editor. Please fix before generating.');
      return;
    }

    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://osdk-backend-osdk.apps-crc.testing';
      const response = await fetch(`${apiUrl}/api/v1/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const filename = `${data.projectName || 'operator-sdk-project'}.zip`;
        await downloadFile(response, filename);
      } else {
        const errorText = await response.text();
        console.error('Generation failed:', errorText);
        alert(`Generation failed: ${errorText}`);
      }
    } catch (error) {
      console.error('Error sending data to backend:', error);
      alert(`Error sending data to backend: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  function createNewCRD() {
    return {
      group: '',
      version: '',
      kind: '',
      plural: '',
      controller: true,
      status: false,
      rbac: [],
      properties: [],
      webhooks: [],
    };
  }
  //remove this 
  function migrateRbacStructure(crd) {
    if (!crd.rbac) {
      return { ...crd, rbac: [] };
    }
    
    if (Array.isArray(crd.rbac)) {
      return crd;
    }
    
    const rbacArray = [];
    const oldRbac = crd.rbac;
    
    if (oldRbac.deployments) rbacArray.push({ group: 'apps', resources: 'deployments', verbs: 'get;list;watch;create;update;patch;delete', preset: 'deployments' });
    if (oldRbac.events) rbacArray.push({ group: '', resources: 'events', verbs: 'create;patch', preset: 'events' });
    if (oldRbac.routes) rbacArray.push({ group: 'route.openshift.io', resources: 'routes', verbs: 'get;list;watch;create;update;patch;delete', preset: 'routes' });
    if (oldRbac.configmaps) rbacArray.push({ group: '', resources: 'configmaps', verbs: 'get;list;watch;create;update;patch;delete', preset: 'configmaps' });
    if (oldRbac.secrets) rbacArray.push({ group: '', resources: 'secrets', verbs: 'get;list;watch;create;update;patch;delete', preset: 'secrets' });
    if (oldRbac.services) rbacArray.push({ group: '', resources: 'services', verbs: 'get;list;watch;create;update;patch;delete', preset: 'services' });
    if (oldRbac.ingresses) rbacArray.push({ group: 'networking.k8s.io', resources: 'ingresses', verbs: 'get;list;watch;create;update;patch;delete', preset: 'ingresses' });
    
    return { ...crd, rbac: rbacArray };
  }

  const currentCRD = crds[currentCRDIndex];

  const updateCurrentCRD = (key, value) => {
    const updatedCRDs = [...crds];
    if (key === 'kind') {
      const prevKind = updatedCRDs[currentCRDIndex].kind;
      const prevPlural = updatedCRDs[currentCRDIndex].plural;
      // Only auto-update plural if it was empty or matched the previous default
      if (!prevPlural || prevPlural === (prevKind ? prevKind + 's' : '')) {
        updatedCRDs[currentCRDIndex].plural = value ? value + 's' : '';
      }
    }
    updatedCRDs[currentCRDIndex][key] = value;
    setCrds(updatedCRDs);
  };

  const addNewCRD = () => {
    setCrds([...crds, createNewCRD()]);
    setCurrentCRDIndex(crds.length);
  };

  const switchCRD = (index) => {
    setCurrentCRDIndex(Number(index));
  };

  // Validation state
  const [errors, setErrors] = useState({ domain: '', repo: '', projectName: '', group: '', version: '', kind: '', properties: [] });
  const [touched, setTouched] = useState({ domain: false, repo: false, projectName: false, group: false, version: false, kind: false, properties: {} });

  // Validation logic
  useEffect(() => {
    const newErrors = { domain: '', repo: '', projectName: '', group: '', version: '', kind: '', properties: [] };
    const domainRegex = /^(([a-zA-Z]{1})|([a-zA-Z]{1}[a-zA-Z]{1})|([a-zA-Z]{1}[0-9]{1})|([0-9]{1}[a-zA-Z]{1})|([a-zA-Z0-9][a-zA-Z0-9-_]{1,61}[a-zA-Z0-9]))\.([a-zA-Z]{2,6}|[a-zA-Z0-9-]{2,30}\.[a-zA-Z]{2,3})$/;
    const repoRegex = /^[\w.-]+\/[\w.-]+(\/[\w.-]+)?(\.git)?$/;
    if (!domain) newErrors.domain = 'Domain is required.';
    else if (!domainRegex.test(domain)) newErrors.domain = 'Invalid domain format.';
    if (!repo) newErrors.repo = 'Repository is required.';
    else if (!repoRegex.test(repo)) newErrors.repo = 'Invalid repository format.';
    if (!projectName) newErrors.projectName = 'Project Name is required.';
    if ((typeof currentCRD.group !== 'string') || currentCRD.group.trim() === '') newErrors.group = 'Group is required.';
    if ((typeof currentCRD.version !== 'string') || currentCRD.version.trim() === '') newErrors.version = 'Version is required.';
    if ((typeof currentCRD.kind !== 'string') || currentCRD.kind.trim() === '') newErrors.kind = 'Kind is required.';
    newErrors.properties = currentCRD.properties.map((prop) => {
      const propErrors = {};
      if (!prop.name) propErrors.name = 'Property name is required.';
      if (!prop.type) propErrors.type = 'Type is required.';
      return propErrors;
    });
    setErrors(newErrors);
  }, [domain, repo, projectName, crds, currentCRDIndex]);


  return (
    <wa-page style={{height: '100vh', display: 'flex', flexDirection: 'column'}}>
      <header slot="header" className="App-header">
        <h1>Operator Builder</h1>
      </header>
      <main slot="main" style={{flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column'}}>
        <div className="App-body" style={{flex: 1, minHeight: 0, overflow: 'hidden'}}>
          <div className="main-content" style={{display: 'flex', height: '100%'}}>
            <div className="form-container" style={{width: '50%', overflowY: 'auto', height: '100%'}}>
              {!sharedStepComplete ? (
                <>
                  <GeneralInfo
                    domain={domain}
                    setDomain={setDomain}
                    repo={repo}
                    setRepo={setRepo}
                    projectName={projectName}
                    setProjectName={setProjectName}
                    namespaced={namespaced}
                    setNamespaced={setNamespaced}
                    namespaces={namespaces}
                    setNamespaces={setNamespaces}
                    errors={errors}
                    touched={touched}
                    setTouched={setTouched}
                  />
                  <wa-button
                    variant="brand"
                    appearance="filled"
                    size="medium"
                    style={{marginTop: '1.5rem'}}
                    onClick={() => {
                      // Validate shared info before proceeding
                      const domainRegex = /^(([a-zA-Z]{1})|([a-zA-Z]{1}[a-zA-Z]{1})|([a-zA-Z]{1}[0-9]{1})|([0-9]{1}[a-zA-Z]{1})|([a-zA-Z0-9][a-zA-Z0-9-_]{1,61}[a-zA-Z0-9]))\.([a-zA-Z]{2,6}|[a-zA-Z0-9-]{2,30}\.[a-zA-Z]{2,3})$/;
                      const repoRegex = /^[\w.-]+\/[\w.-]+(\/[\w.-]+)?(\.git)?$/;
                      let valid = true;
                      if (!domain || !domainRegex.test(domain)) valid = false;
                      if (!repo || !repoRegex.test(repo)) valid = false;
                      if (!projectName) valid = false;
                      setTouched(t => ({...t, domain: true, repo: true, projectName: true}));
                      if (valid) setSharedStepComplete(true);
                    }}
                  >Next: Define CRDs</wa-button>
                </>
              ) : (
                <>
                  <CRDDetails
                    group={currentCRD.group}
                    setGroup={(value) => updateCurrentCRD('group', value)}
                    version={currentCRD.version}
                    setVersion={(value) => updateCurrentCRD('version', value)}
                    kind={currentCRD.kind}
                    setKind={(value) => updateCurrentCRD('kind', value)}
                    plural={currentCRD.plural}
                    setPlural={(value) => updateCurrentCRD('plural', value)}
                    controller={currentCRD.controller}
                    setController={(value) => updateCurrentCRD('controller', value)}
                    status={currentCRD.status}
                    setStatus={(value) => updateCurrentCRD('status', value)}
                    rbac={Array.isArray(currentCRD.rbac) ? currentCRD.rbac : []}
                    setRbac={(value) => updateCurrentCRD('rbac', value)}
                    addRbacPermission={() => {
                      const currentRbac = Array.isArray(currentCRD.rbac) ? currentCRD.rbac : [];
                      const updatedRbac = [...currentRbac, { group: '', resources: '', verbs: '' }];
                      updateCurrentCRD('rbac', updatedRbac);
                    }}
                    updateRbacPermission={(index, key, value) => {
                      const currentRbac = Array.isArray(currentCRD.rbac) ? currentCRD.rbac : [];
                      const updatedRbac = [...currentRbac];
                      updatedRbac[index][key] = value;
                      updateCurrentCRD('rbac', updatedRbac);
                    }}
                    removeRbacPermission={(index) => {
                      const currentRbac = Array.isArray(currentCRD.rbac) ? currentCRD.rbac : [];
                      const updatedRbac = currentRbac.filter((_, i) => i !== index);
                      updateCurrentCRD('rbac', updatedRbac);
                    }}
                    webhooks={Array.isArray(currentCRD.webhooks) ? currentCRD.webhooks : []}
                    setWebhooks={(value) => updateCurrentCRD('webhooks', value)}
                    addWebhook={() => {
                      const currentWebhooks = Array.isArray(currentCRD.webhooks) ? currentCRD.webhooks : [];
                      // Default to watching the current CRD's resources
                      const defaultResources = currentCRD.plural || `${currentCRD.kind.toLowerCase()}s`;
                      const webhookType = 'mutating';
                      const defaultPath = `/mutate-${currentCRD.version.toLowerCase()}-${currentCRD.kind.toLowerCase()}`;
                      
                      const updatedWebhooks = [...currentWebhooks, { 
                        type: webhookType, 
                        failurePolicy: 'Fail',
                        sideEffects: 'None',
                        matchPolicy: 'Exact',
                        path: defaultPath,
                        operations: [],
                        resources: [defaultResources]
                      }];
                      updateCurrentCRD('webhooks', updatedWebhooks);
                    }}
                    updateWebhook={(index, key, value) => {
                      const currentWebhooks = Array.isArray(currentCRD.webhooks) ? currentCRD.webhooks : [];
                      const updatedWebhooks = [...currentWebhooks];
                      updatedWebhooks[index][key] = value;
                      updateCurrentCRD('webhooks', updatedWebhooks);
                    }}
                    removeWebhook={(index) => {
                      const currentWebhooks = Array.isArray(currentCRD.webhooks) ? currentCRD.webhooks : [];
                      const updatedWebhooks = currentWebhooks.filter((_, i) => i !== index);
                      updateCurrentCRD('webhooks', updatedWebhooks);
                    }}
                    addNewCRD={addNewCRD}
                    switchCRD={switchCRD}
                    crdList={crds}
                    currentCRDIndex={currentCRDIndex}
                    properties={currentCRD.properties}
                    addProperty={() => {
                      const updatedProperties = [...currentCRD.properties, { name: '', type: ''}];
                      updateCurrentCRD('properties', updatedProperties);
                    }}
                    updateProperty={(index, key, value) => {
                      const updatedProperties = [...currentCRD.properties];
                      updatedProperties[index][key] = value;
                      updateCurrentCRD('properties', updatedProperties);
                    }}
                    removeProperty={(index) => {
                      const updatedProperties = currentCRD.properties.filter((_, i) => i !== index);
                      updateCurrentCRD('properties', updatedProperties);
                    }}
                    errors={errors}
                    touched={touched}
                    setTouched={setTouched}
                  />
                  <wa-button
                    variant="outline"
                    size="medium"
                    style={{marginTop: '1.5rem', marginRight: '1rem'}}
                    onClick={() => setSharedStepComplete(false)}
                  >Back</wa-button>
                </>
              )}
            </div>
            <div className="editor-container" style={{flex: '1 1 0', height: '100%', padding: 0, minWidth: 0}}>
              <Editor
                height="100%"
                width="100%"
                options={{minimap: {enabled: false}}}
                defaultLanguage="json"
                value={editorValue}
                onChange={(value) => {
                  setEditorValue(value);
                  try {
                    const parsed = JSON.parse(value);
                    setDomain(parsed.domain || '');
                    setRepo(parsed.repo || '');
                    setProjectName(parsed.projectName || '');
                    if (Array.isArray(parsed.namespaces)) {
                      setNamespaced(parsed.namespaces.length > 0);
                      setNamespaces(parsed.namespaces.join(','));
                    } else if (typeof parsed.namespaces === 'string') {
                      setNamespaced(parsed.namespaces.trim() !== '');
                      setNamespaces(parsed.namespaces);
                    } else {
                      setNamespaced(false);
                      setNamespaces('');
                    }
                    const migratedCrds = (parsed.crds || []).map(migrateRbacStructure);
                    setCrds(migratedCrds);
                    // Ensure selector shows first CRD after full load
                    if (migratedCrds.length > 0) {
                      setCurrentCRDIndex(0);
                    }
                  } catch (error) {
                    // Do not update state if invalid JSON
                  }
                }}
              />
            </div>
          </div>
        </div>
      </main>
      <footer slot="footer" style={{display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '1rem', flexShrink: 0, background: '#f5f7fa', borderTop: '1px solid #e0e0e0', gap: '1rem'}}>
        {sharedStepComplete && (
          <>
            {isGenerating && (
              <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                <wa-spinner style={{fontSize: '1.5rem'}}></wa-spinner>
                <span>
                  {downloadProgress > 0 
                    ? `Downloading... ${downloadProgress}%` 
                    : 'Generating your operator...'
                  }
                </span>
              </div>
            )}
            <wa-button 
              variant="brand" 
              appearance="filled" 
              size="medium" 
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Generate'}
            </wa-button>
          </>
        )}
      </footer>
    </wa-page>
  );
}

export default App;