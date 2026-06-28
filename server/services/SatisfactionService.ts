import {
  SatisfactionRepository,
  type SatisfactionRow,
  type SatisfactionQueryOptions,
} from '../repositories/SatisfactionRepository.js'

export class SatisfactionService {
  static async getSatisfactionData(
    opts: SatisfactionQueryOptions = {},
  ): Promise<{ data: SatisfactionRow[]; total: number; columns: string[] }> {
    return SatisfactionRepository.findAll(opts)
  }

  static async createEntry(data: SatisfactionRow): Promise<void> {
    await SatisfactionRepository.create(data)
  }

  static async updateEntry(id: unknown, data: SatisfactionRow): Promise<number> {
    return SatisfactionRepository.update(id, data)
  }

  static async deleteEntry(id: unknown): Promise<number> {
    return SatisfactionRepository.delete(id)
  }
}
