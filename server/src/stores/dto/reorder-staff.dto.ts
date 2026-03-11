import { IsArray, ArrayMinSize, ArrayUnique, IsInt, Min } from 'class-validator';

export class ReorderStaffDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  orderedIds!: number[];
}
