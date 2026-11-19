import {outlookResponse} from '@/lib/strategicOutlookPublication';

export const dynamic = 'force-static';
export function GET() { return outlookResponse('json'); }
