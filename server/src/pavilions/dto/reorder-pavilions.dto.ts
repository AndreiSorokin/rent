import { ArrayMinSize, IsArray, IsInt } from 'class-validator';

export class ReorderPavilionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  orderedIds!: number[];
}
