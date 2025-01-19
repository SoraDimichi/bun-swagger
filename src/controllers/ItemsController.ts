import {
  Controller,
  Get,
  Route,
  Tags,
  OperationId,
  Path,
  Response,
  SuccessResponse,
} from "tsoa";
import { db } from "../db";
import type { Item } from "../models/Item";

@Route("items")
@Tags("Items")
export class ItemsController extends Controller {
  private initializeDatabase() {}

  /**
   * Retrieve a list of all items.
   */
  @Get("/")
  @OperationId("getAllItems")
  @SuccessResponse("200", "OK")
  public async getAllItems(): Promise<Item[]> {
    const rows = db.query("SELECT * FROM items").all();
    return rows as Item[];
  }

  /**
   * Retrieve a single item by its ID.
   * @param id The ID of the item to retrieve.
   */
  @Get("{id}")
  @OperationId("getItemById")
  @SuccessResponse("200", "OK")
  @Response("404", "Item not found")
  public async getItemById(@Path() id: number): Promise<Item | {}> {
    const row = db.query("SELECT * FROM items WHERE id = ?").get(id);
    if (row) return row as Item;

    this.setStatus(404);
    return {};
  }
}
