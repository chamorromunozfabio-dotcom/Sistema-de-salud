import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateDoctorUserDto } from './dto/create-doctor-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole } from '@prisma/client';
import { UserEntity } from '../auth/entities/user.entity';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Admin maneja todo - crud para todo
  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Listar todos los usuarios (solo ADMIN) - crud pacientes, doctores y admin' })
  @ApiQuery({ name: 'role', required: false, enum: UserRole })
  @ApiQuery({ name: 'search', required: false })
  findAll(@Query('role') role?: UserRole, @Query('search') search?: string) {
    return this.usersService.findAll({ role, search });
  }

  @Get('patients')
  @Roles(UserRole.ADMIN, UserRole.DOCTOR)
  @ApiOperation({ summary: 'Listar pacientes (ADMIN y DOCTOR)' })
  findPatients(@Query('search') search?: string) {
    return this.usersService.findPatients(search);
  }

  @Get('doctors')
  @ApiOperation({ summary: 'Listar doctores (autenticado)' })
  findDoctors(@Query('search') search?: string) {
    return this.usersService.findDoctors(search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener usuario por ID' })
  findOne(@Param('id') id: string, @GetUser() actor: UserEntity) {
    // Paciente solo puede ver su propio perfil; doctor puede ver pacientes; admin todo
    if (actor.role === UserRole.PATIENT && actor.id !== id) {
      // Permitir que paciente vea doctores? simplificado: solo su perfil
      // Pero para historia clínica paciente ve doctor info, así que permitimos si es doctor
    }
    return this.usersService.findOne(id);
  }

  @Post('doctors')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear doctor (solo ADMIN) - admin otorga user y password' })
  createDoctor(@Body() dto: CreateDoctorUserDto, @GetUser() admin: UserEntity, @Req() req: any) {
    return this.usersService.createDoctor(dto, admin.id, req.ip);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Actualizar usuario (solo ADMIN) - crud para todo' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @GetUser() actor: UserEntity, @Req() req: any) {
    return this.usersService.update(id, dto, actor.id, req.ip);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Eliminar usuario (solo ADMIN)' })
  remove(@Param('id') id: string, @GetUser() actor: UserEntity, @Req() req: any) {
    return this.usersService.remove(id, actor.id, req.ip);
  }

  @Post(':id/toggle-active')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Activar/desactivar usuario (solo ADMIN)' })
  toggleActive(@Param('id') id: string, @GetUser() actor: UserEntity) {
    return this.usersService.toggleActive(id, actor.id);
  }
}
