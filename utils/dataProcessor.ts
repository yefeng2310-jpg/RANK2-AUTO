import { CatalogItem } from '../types';

export const parseCSV = (csvText: string): CatalogItem[] => {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  // Simple CSV parser - assuming comma separated for this demo
  // In a real prod app, use PapaParse for robust handling of quotes/newlines
  const headers = lines[0].split(',').map(h => h.trim());
  
  const data: CatalogItem[] = [];

  for (let i = 1; i < lines.length; i++) {
    const currentLine = lines[i].split(',');
    if (currentLine.length !== headers.length) continue; // Skip malformed lines

    const item: any = {};
    headers.forEach((header, index) => {
      // Basic cleaning
      let value = currentLine[index]?.trim();
      // Try to convert to number if it looks like one
      if (!isNaN(Number(value)) && value !== '') {
        item[header] = Number(value);
      } else {
        item[header] = value;
      }
    });

    // Ensure it has an ID at minimum to be valid
    item.id = item.id || `row-${i}`; 
    data.push(item as CatalogItem);
  }

  return data;
};

export const chunkArray = <T,>(array: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

// Extracts Sheet ID and GID from a standard Google Sheet URL
export const parseGoogleSheetUrl = (url: string): { id: string, gid: string } | null => {
  try {
    const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    const id = idMatch ? idMatch[1] : null;

    let gid = '0';
    const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
    if (gidMatch) {
      gid = gidMatch[1];
    }

    if (id) return { id, gid };
    return null;
  } catch (e) {
    return null;
  }
};

export const constructCsvExportUrl = (id: string, gid: string): string => {
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
};