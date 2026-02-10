// Quick test script to check SCORM version detection
import fs from 'fs';
import xml2js from 'xml2js';

const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });

// Test with a sample manifest
const testManifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1" 
          xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3" 
          xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"
          xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"
          xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
          identifier="test" version="1.0">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 4th Edition</schemaversion>
  </metadata>
  <organizations default="ORG-1">
    <organization identifier="ORG-1">
      <title>Test Course</title>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-1" type="webcontent" href="index.html">
      <file href="index.html"/>
    </resource>
  </resources>
</manifest>`;

async function test() {
    console.log('Testing SCORM version detection...\n');
    
    const manifest = await parser.parseStringPromise(testManifest);
    const root = manifest.manifest;
    
    console.log('Root attributes:', root['$']);
    console.log('\nChecking for xmlns:adlseq:', root['$'] ? root['$']['xmlns:adlseq'] : 'NOT FOUND');
    console.log('Checking for xmlns:imsss:', root['$'] ? root['$']['xmlns:imsss'] : 'NOT FOUND');
    console.log('\nMetadata:', root.metadata);
    console.log('Schema version:', root.metadata?.schemaversion);
    
    // Test detection logic
    if (root['$'] && (root['$']['xmlns:adlseq'] || root['$']['xmlns:imsss'])) {
        console.log('\n✅ Would detect as SCORM 2004');
    } else if (root.metadata?.schemaversion === '1.2') {
        console.log('\n✅ Would detect as SCORM 1.2');
    } else {
        console.log('\n❌ Would FAIL to detect version');
    }
}

test().catch(console.error);
