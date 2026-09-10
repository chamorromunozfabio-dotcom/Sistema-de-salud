import { IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class ChangeRoleDto {
  @ApiProperty({ example: 'uuid-del-usuario' })
  @IsUUID()
  userId: string;

  @ApiProperty({ enum: UserRole, example: UserRole.DOCTOR })
  @IsString()
  newRole: UserRole;
}
