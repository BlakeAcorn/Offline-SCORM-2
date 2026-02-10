import fs from 'fs';
import { promisify } from 'util';
import xml2js from 'xml2js';
import path from 'path';
import { findFile } from '../utils/file-system.js';

const readFile = promisify(fs.readFile);
const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });

/**
 * Parse SCORM package manifest
 */
export class ScormParser {
  /**
   * Find and parse imsmanifest.xml from extracted package
   */
  async parseManifest(packagePath) {
    try {
      const manifestPath = await findFile(packagePath, 'imsmanifest.xml');
      
      if (!manifestPath) {
        throw new Error('imsmanifest.xml not found in package');
      }

      const manifestContent = await readFile(manifestPath, 'utf8');
      const manifest = await parser.parseStringPromise(manifestContent);

      // Debug logging for troubleshooting
      console.log('Manifest parsed successfully');
      console.log('Root keys:', Object.keys(manifest));
      if (manifest.manifest) {
        console.log('Manifest root keys:', Object.keys(manifest.manifest));
        if (manifest.manifest['$']) {
          console.log('Manifest attributes:', manifest.manifest['$']);
        }
        if (manifest.manifest.metadata) {
          console.log('Manifest metadata:', manifest.manifest.metadata);
        }
      }

      return this.extractManifestData(manifest, packagePath);
    } catch (error) {
      console.error('Manifest parsing error:', error);
      throw new Error(`Failed to parse manifest: ${error.message}`);
    }
  }

  /**
   * Extract relevant data from parsed manifest
   */
  extractManifestData(manifest, packagePath) {
    const result = {
      version: this.detectScormVersion(manifest),
      metadata: this.extractMetadata(manifest),
      organizations: this.extractOrganizations(manifest),
      resources: this.extractResources(manifest, packagePath),
      sequencing: this.extractSequencing(manifest),
    };

    // Get default organization
    const defaultOrg = this.getDefaultOrganization(manifest, result.organizations);
    if (defaultOrg) {
      result.title = defaultOrg.title || 'SCORM Module';
      result.identifier = defaultOrg.identifier;
      result.launchData = this.getLaunchData(defaultOrg, result.resources);
    }

    return result;
  }

  /**
   * Detect SCORM version from manifest
   */
  detectScormVersion(manifest) {
    const root = manifest.manifest;
    
    if (!root) {
      throw new Error('Invalid manifest structure');
    }

    const attrs = root['$'] || {};
    const metadata = root.metadata || {};
    const schemaVersion = metadata.schemaversion || metadata.schemaVersion || '';
    const manifestVersion = attrs.version || '';
    const schemaLocation = attrs['xsi:schemaLocation'] || '';

    // Check metadata schema version first (most reliable)
    if (schemaVersion) {
      if (schemaVersion.includes('2004') || schemaVersion === 'CAM 1.3') {
        return schemaVersion.includes('3rd') ? '2004 3rd Edition' : 
               schemaVersion.includes('4th') ? '2004 4th Edition' : 
               '2004';
      }
      if (schemaVersion === '1.2') {
        return '1.2';
      }
    }

    // Check for SCORM 2004 namespaces (adlseq, adlnav, imsss)
    if (attrs['xmlns:adlseq'] || attrs['xmlns:adlnav'] || attrs['xmlns:imsss']) {
      return '2004';
    }

    // Check schema location for version indicators
    if (schemaLocation) {
      if (schemaLocation.includes('adlseq') || 
          schemaLocation.includes('adlnav') || 
          schemaLocation.includes('imsss') ||
          schemaLocation.includes('2004')) {
        return '2004';
      }
      if (schemaLocation.includes('1.2') || schemaLocation.includes('adlcp_rootv1p2')) {
        return '1.2';
      }
    }

    // Check manifest version attribute
    if (manifestVersion === '1.2') {
      return '1.2';
    }

    // Check for specific SCORM 1.2 schema
    const schema = metadata.schema || '';
    if (schema === 'ADL SCORM' && !schemaVersion.includes('2004')) {
      // If schema is ADL SCORM but no version, likely 1.2
      return '1.2';
    }

    // Last resort: check for SCORM 2004 specific elements
    if (root.organizations?.organization?.item?.sequencing || 
        root.organizations?.organization?.sequencing) {
      return '2004';
    }

    throw new Error('Unable to detect SCORM version. Please ensure your package includes a valid imsmanifest.xml file.');
  }

  /**
   * Extract metadata from manifest
   */
  extractMetadata(manifest) {
    const metadata = manifest.manifest.metadata;
    
    if (!metadata) {
      return {};
    }

    return {
      schema: metadata.schema,
      schemaVersion: metadata.schemaversion,
      general: metadata.general ? {
        title: this.extractLangString(metadata.general.title),
        description: this.extractLangString(metadata.general.description),
        keywords: metadata.general.keyword,
      } : {},
    };
  }

  /**
   * Extract organizations from manifest
   */
  extractOrganizations(manifest) {
    const orgs = manifest.manifest.organizations;
    
    if (!orgs || !orgs.organization) {
      return [];
    }

    const organizations = Array.isArray(orgs.organization) 
      ? orgs.organization 
      : [orgs.organization];

    return organizations.map(org => ({
      identifier: org.identifier,
      title: this.extractLangString(org.title),
      structure: org.structure,
      items: this.extractItems(org.item),
    }));
  }

  /**
   * Recursively extract items (SCOs and assets)
   */
  extractItems(items) {
    if (!items) return [];

    const itemArray = Array.isArray(items) ? items : [items];

    return itemArray.map(item => ({
      identifier: item.identifier,
      identifierref: item.identifierref,
      title: this.extractLangString(item.title),
      isvisible: item.isvisible !== 'false',
      parameters: item.parameters,
      sequencing: item.sequencing,
      prerequisites: item.prerequisites,
      maxtimeallowed: item.maxtimeallowed,
      timelimitaction: item.timelimitaction,
      datafromlms: item.datafromlms,
      masteryscore: item.masteryscore,
      children: this.extractItems(item.item),
    }));
  }

  /**
   * Extract resources from manifest
   */
  extractResources(manifest, packagePath) {
    const resources = manifest.manifest.resources;
    
    if (!resources || !resources.resource) {
      return [];
    }

    const resourceArray = Array.isArray(resources.resource) 
      ? resources.resource 
      : [resources.resource];

    return resourceArray.map(resource => {
      const files = resource.file ? 
        (Array.isArray(resource.file) ? resource.file : [resource.file]) : [];

      return {
        identifier: resource.identifier,
        type: resource.type,
        href: resource.href,
        scormType: resource['adlcp:scormtype'] || resource.scormtype,
        metadata: resource.metadata,
        files: files.map(f => f.href),
        dependencies: this.extractDependencies(resource.dependency),
      };
    });
  }

  /**
   * Extract resource dependencies
   */
  extractDependencies(dependencies) {
    if (!dependencies) return [];
    
    const depArray = Array.isArray(dependencies) ? dependencies : [dependencies];
    return depArray.map(dep => dep.identifierref);
  }

  /**
   * Extract sequencing information (SCORM 2004)
   */
  extractSequencing(manifest) {
    const orgs = manifest.manifest.organizations;
    
    if (!orgs || !orgs.organization) {
      return null;
    }

    const org = Array.isArray(orgs.organization) 
      ? orgs.organization[0] 
      : orgs.organization;

    if (!org.sequencing && !org['imsss:sequencing']) {
      return null;
    }

    // This is a simplified extraction - full sequencing is complex
    const sequencing = org.sequencing || org['imsss:sequencing'];
    
    return {
      controlMode: sequencing['imsss:controlMode'] || sequencing.controlMode,
      sequencingRules: sequencing['imsss:sequencingRules'] || sequencing.sequencingRules,
      rollupRules: sequencing['imsss:rollupRules'] || sequencing.rollupRules,
      objectives: sequencing['imsss:objectives'] || sequencing.objectives,
      deliveryControls: sequencing['imsss:deliveryControls'] || sequencing.deliveryControls,
    };
  }

  /**
   * Get default organization
   */
  getDefaultOrganization(manifest, organizations) {
    if (!organizations || organizations.length === 0) {
      return null;
    }

    const defaultOrgId = manifest.manifest.organizations?.default;
    
    if (defaultOrgId) {
      const defaultOrg = organizations.find(org => org.identifier === defaultOrgId);
      if (defaultOrg) return defaultOrg;
    }

    return organizations[0];
  }

  /**
   * Get launch data for first SCO
   */
  getLaunchData(organization, resources) {
    if (!organization.items || organization.items.length === 0) {
      return null;
    }

    // Find first launchable item (SCO)
    const firstSco = this.findFirstSco(organization.items);
    
    if (!firstSco || !firstSco.identifierref) {
      return null;
    }

    const resource = resources.find(r => r.identifier === firstSco.identifierref);
    
    if (!resource || !resource.href) {
      return null;
    }

    return {
      identifier: firstSco.identifier,
      resource: resource.identifier,
      launchUrl: resource.href,
      parameters: firstSco.parameters,
      scormType: resource.scormType,
    };
  }

  /**
   * Recursively find first SCO in items tree
   */
  findFirstSco(items) {
    for (const item of items) {
      // If item has identifierref, it's a potential SCO
      if (item.identifierref) {
        return item;
      }
      
      // Check children
      if (item.children && item.children.length > 0) {
        const sco = this.findFirstSco(item.children);
        if (sco) return sco;
      }
    }
    
    return null;
  }

  /**
   * Extract language string (can be object or simple string)
   */
  extractLangString(value) {
    if (!value) return '';
    
    if (typeof value === 'string') {
      return value;
    }

    if (value.langstring) {
      const langString = value.langstring;
      if (typeof langString === 'string') {
        return langString;
      }
      if (langString._) {
        return langString._;
      }
    }

    if (value._) {
      return value._;
    }

    return '';
  }

  /**
   * Get all SCOs from organization
   */
  getAllScos(organization, resources) {
    const scos = [];
    
    const collectScos = (items) => {
      for (const item of items) {
        if (item.identifierref) {
          const resource = resources.find(r => r.identifier === item.identifierref);
          if (resource && resource.scormType === 'sco') {
            scos.push({
              identifier: item.identifier,
              title: item.title,
              resource: resource.identifier,
              launchUrl: resource.href,
              parameters: item.parameters,
            });
          }
        }
        
        if (item.children && item.children.length > 0) {
          collectScos(item.children);
        }
      }
    };

    if (organization.items) {
      collectScos(organization.items);
    }

    return scos;
  }
}

export default new ScormParser();
