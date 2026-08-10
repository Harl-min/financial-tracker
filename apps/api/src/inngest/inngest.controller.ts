import { All, Controller, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { serve } from "inngest/express";
import { inngest } from "./inngest.client";
import { InngestService } from "./inngest.service";

@Controller("inngest")
export class InngestController {
  private handler: ReturnType<typeof serve>;

  constructor(private inngestService: InngestService) {
    this.handler = serve({ client: inngest, functions: this.inngestService.functions });
  }

  @All()
  handle(@Req() req: Request, @Res() res: Response) {
    return this.handler(req, res);
  }
}
