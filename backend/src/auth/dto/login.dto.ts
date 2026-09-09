import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { sanitizeString } from '../../common/utils/sanitize';

export class LoginDto {
  @ApiProperty({
    description: 'Email del usuario',
    example: 'juan.perez@email.com',
  })
  @IsEmail({}, { message: 'Email inválido' })
  @Transform(({ value }) => sanitizeString(String(value).toLowerCase()))
  email: string;

  @ApiProperty({
    description: 'Contraseña del usuario',
    example: 'Password123',
  })
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password: string;
}
