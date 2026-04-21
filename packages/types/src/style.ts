import type { Style } from "./reply.js";

export interface StyleSample {
  id: string;
  style: Style;
  text: string;
  source_message_id?: string;
  source_chat_id?: string;
  extracted_at: string;
  approved: boolean;
}
