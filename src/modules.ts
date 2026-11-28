import { CloudRain, FileText, Layers, Mail, MapPin, TreeDeciduous, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ModuleType } from './types';

export const modules = [
  { id: 'DISPATCH', icon: Mail, title: 'Dispatch & Letters', odia: 'ପତ୍ର ଓ ପ୍ରେରଣ ରେଜିଷ୍ଟର', description: 'Prepare letters, sign PDFs, and review the annual dispatch register.' },
  { id: 'ENCROACHMENT', icon: MapPin, title: 'G Form & Register IV', odia: 'ଗ ଫରମ ଓ ରେଜିଷ୍ଟର IV', description: 'Issue encroachment reports and export Register IV.' },
  { id: 'KHANA_2', icon: FileText, title: 'Khana-2 Correction', odia: 'ଖାନା-୨ ସ୍ୱତ୍ୱଲିପି ସଂଶୋଧନ', description: 'Read RoR PDFs, record field findings, and prepare correction reports.' },
  { id: 'COLUMN_2_CAMP', icon: Layers, title: 'Column 2 Camp', odia: 'ଖାନା-୨ କ୍ୟାମ୍ପ', description: 'Record camp enquiries and prepare Annexure II.' },
  { id: 'FARMER_VERIFICATION', icon: TreeDeciduous, title: 'Farmer Land Share (PPAS)', odia: 'କୃଷକ ବଂଶାବଳୀ ଓ ଜମି ଭାଗ', description: 'Verify farmer genealogy and prepare land-share reports.' },
  { id: 'LEGAL_HEIR_ENQUIRY', icon: Users, title: 'Legal Heir Enquiry', odia: 'ଉତ୍ତରାଧିକାରୀ ପ୍ରମାଣପତ୍ର ତଦନ୍ତ', description: 'Record family details and prepare legal-heir enquiry reports.' },
  { id: 'DISASTER_MANAGEMENT', icon: CloudRain, title: 'Disaster Damage & Relief', odia: 'ବିପର୍ଯ୍ୟୟ ଓ ଗୃହ କ୍ଷତିଗ୍ରସ୍ତ ତଦନ୍ତ', description: 'Record damage, photo evidence, and assistance details.' },
] as const satisfies readonly {
  id: Exclude<ModuleType, 'HOME'>;
  icon: LucideIcon;
  title: string;
  odia: string;
  description: string;
}[];
