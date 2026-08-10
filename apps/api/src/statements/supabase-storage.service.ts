import { Injectable } from "@nestjs/common";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class SupabaseStorageService {
  private client: SupabaseClient;
  private bucket: string;

  constructor() {
    this.client = createClient(
      process.env.SUPABASE_URL ?? "",
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    );
    this.bucket = process.env.SUPABASE_STATEMENTS_BUCKET ?? "bank-statements";
  }

  /** Uploads a raw file buffer and returns its storage path. */
  async upload(userId: string, fileName: string, buffer: Buffer, contentType: string) {
    const path = `${userId}/${Date.now()}-${fileName}`;
    const { error } = await this.client.storage.from(this.bucket).upload(path, buffer, {
      contentType,
      upsert: false,
    });
    if (error) throw new Error(`Supabase upload failed: ${error.message}`);
    return path;
  }

  async download(path: string): Promise<Buffer> {
    const { data, error } = await this.client.storage.from(this.bucket).download(path);
    if (error) throw new Error(`Supabase download failed: ${error.message}`);
    return Buffer.from(await data.arrayBuffer());
  }

  async getSignedUrl(path: string, expiresInSeconds = 60 * 10) {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(path, expiresInSeconds);
    if (error) throw new Error(`Supabase signed URL failed: ${error.message}`);
    return data.signedUrl;
  }
}
