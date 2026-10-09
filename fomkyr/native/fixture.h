/* SPDX-License-Identifier: MIT */
#ifndef FK_FIXTURE_H
#define FK_FIXTURE_H
#include "support.h"
#include "../src/kernel.h"
typedef struct {u8*w;u32 degree;i64 c;} InputTerm;
typedef struct {InputTerm*t;u32 n,degree,capacity;} InputRelation;
typedef struct {char*vars[16];u32 nv;InputRelation*r;u32 nr,max_degree,capacity;char*canonical,*variables_json,*relations_json;} Fixture;
int fixture_read(Fixture*,const char*,char*,size_t);void fixture_free(Fixture*);
void fixture_identity(Fixture*,u32,char[65]);int fixture_load_degree(Fixture*,u32);
#endif
